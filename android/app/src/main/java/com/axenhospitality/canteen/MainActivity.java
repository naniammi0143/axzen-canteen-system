package com.axenhospitality.canteen;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    private static final int BLUETOOTH_PERMISSION_REQUEST = 58;
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBars();
        requestBluetoothPermission();
        getBridge().getWebView().addJavascriptInterface(new ThermalPrinterBridge(), "AxenPrinter");
        getBridge().getWebView().addJavascriptInterface(new ShareBridge(), "AxenShare");
    }

    private void applySystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(false);
    }

    private void requestBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<String> permissions = new ArrayList<>();
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_SCAN);
            }
            if (!permissions.isEmpty()) {
                ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), BLUETOOTH_PERMISSION_REQUEST);
            }
        }
    }

    private boolean hasBluetoothPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean hasBluetoothScanPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
    }

    public class ThermalPrinterBridge {
        private BluetoothSocket socket;
        private OutputStream output;
        private BluetoothDevice cachedPrinter;
        private String selectedPrinterAddress = "";

        @JavascriptInterface
        public synchronized String wake() {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            try {
                OutputStream output = ensurePrinterOutput();
                output.write(new byte[]{0x1B, 0x40});
                output.flush();
                return "Printer ready";
            } catch (Exception error) {
                closePrinter();
                return "Printer failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public synchronized String print(String text) {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            try {
                OutputStream output = ensurePrinterOutput();
                output.write(new byte[]{0x1B, 0x40});
                output.write(text.getBytes(Charset.forName("UTF-8")));
                output.write(new byte[]{0x0A, 0x0A, 0x1D, 0x56, 0x01});
                output.flush();
                return "Print sent";
            } catch (Exception error) {
                closePrinter();
                return "Printer failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String printAsync(String text) {
            new Thread(() -> {
                try {
                    print(text);
                } catch (Exception ignored) {}
            }).start();
            return "Print queued";
        }

        @JavascriptInterface
        public synchronized String listPrinters() {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "[]";
            }

            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) return "[]";

                Set<BluetoothDevice> devices = adapter.getBondedDevices();
                if (devices == null || devices.isEmpty()) return "[]";

                StringBuilder json = new StringBuilder("[");
                boolean first = true;
                for (BluetoothDevice device : devices) {
                    if (!first) json.append(",");
                    first = false;
                    json.append("{\"name\":\"")
                            .append(jsonEscape(device.getName() == null ? "Bluetooth Device" : device.getName()))
                            .append("\",\"address\":\"")
                            .append(jsonEscape(device.getAddress()))
                            .append("\"}");
                }
                json.append("]");
                return json.toString();
            } catch (Exception ignored) {
                return "[]";
            }
        }

        @JavascriptInterface
        public synchronized String selectPrinter(String address) {
            String nextAddress = address == null ? "" : address.trim();
            if (!nextAddress.equals(selectedPrinterAddress)) {
                selectedPrinterAddress = nextAddress;
                cachedPrinter = null;
                closePrinter();
            }
            return selectedPrinterAddress.isEmpty() ? "Auto select printer" : "Selected printer saved";
        }

        private OutputStream ensurePrinterOutput() throws Exception {
            if (socket != null && socket.isConnected() && output != null) {
                return output;
            }

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) throw new Exception("Bluetooth is off");

            Set<BluetoothDevice> devices = adapter.getBondedDevices();
            if (devices == null || devices.isEmpty()) throw new Exception("Pair the 58mm printer first");

            cachedPrinter = cachedPrinter == null ? selectedOrDefaultPrinter(devices) : cachedPrinter;
            if (hasBluetoothScanPermission()) {
                adapter.cancelDiscovery();
            }
            socket = cachedPrinter.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            output = socket.getOutputStream();
            return output;
        }

        private void closePrinter() {
            try {
                if (output != null) output.close();
            } catch (Exception ignored) {}
            try {
                if (socket != null) socket.close();
            } catch (Exception ignored) {}
            output = null;
            socket = null;
        }

        private BluetoothDevice selectedOrDefaultPrinter(Set<BluetoothDevice> devices) throws Exception {
            if (!selectedPrinterAddress.isEmpty()) {
                for (BluetoothDevice device : devices) {
                    if (selectedPrinterAddress.equals(device.getAddress())) {
                        return device;
                    }
                }
                throw new Exception("Selected printer not paired");
            }
            return findPrinter(devices);
        }

        private BluetoothDevice findPrinter(Set<BluetoothDevice> devices) {
            for (BluetoothDevice device : devices) {
                String name = device.getName() == null ? "" : device.getName().toLowerCase();
                if (name.contains("printer") || name.contains("58") || name.contains("pos") || name.contains("thermal")) {
                    return device;
                }
            }
            return devices.iterator().next();
        }

        private String jsonEscape(String value) {
            return value == null ? "" : value
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
        }
    }

    public class ShareBridge {
        @JavascriptInterface
        public String sharePng(String dataUrl, String fileName, String title) {
            try {
                if (dataUrl == null || dataUrl.trim().isEmpty()) return "Share failed: empty image";
                String base64 = dataUrl.contains(",") ? dataUrl.substring(dataUrl.indexOf(",") + 1) : dataUrl;
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                File dir = new File(getCacheDir(), "shared-reports");
                if (!dir.exists() && !dir.mkdirs()) return "Share failed: cache not ready";
                String safeName = (fileName == null || fileName.trim().isEmpty() ? "day-close.png" : fileName)
                        .replaceAll("[^a-zA-Z0-9._-]", "-");
                File file = new File(dir, safeName.endsWith(".png") ? safeName : safeName + ".png");
                try (FileOutputStream stream = new FileOutputStream(file)) {
                    stream.write(bytes);
                }
                Uri uri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        file
                );
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("image/png");
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title == null ? "Day Close Report" : title);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(shareIntent, title == null ? "Share Report" : title);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                runOnUiThread(() -> startActivity(chooser));
                return "Share opened";
            } catch (Exception error) {
                return "Share failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String sharePdf(String text, String fileName, String title) {
            try {
                String safeName = (fileName == null || fileName.trim().isEmpty() ? "report.pdf" : fileName)
                        .replaceAll("[^a-zA-Z0-9._-]", "-");
                if (!safeName.endsWith(".pdf")) safeName = safeName + ".pdf";
                File dir = new File(getCacheDir(), "shared-reports");
                if (!dir.exists() && !dir.mkdirs()) return "Share failed: cache not ready";
                File file = new File(dir, safeName);

                PdfDocument document = new PdfDocument();
                Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
                paint.setColor(Color.rgb(15, 23, 42));
                paint.setTextSize(13);
                paint.setTypeface(android.graphics.Typeface.MONOSPACE);

                int pageWidth = 595;
                int pageHeight = 842;
                int margin = 36;
                int y = 46;
                int lineHeight = 18;
                PdfDocument.Page page = document.startPage(new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, 1).create());
                Canvas canvas = page.getCanvas();
                String[] lines = (text == null ? "" : text).split("\\n");
                int pageNo = 1;

                for (String line : lines) {
                    if (y > pageHeight - margin) {
                        document.finishPage(page);
                        pageNo++;
                        page = document.startPage(new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNo).create());
                        canvas = page.getCanvas();
                        y = 46;
                    }
                    canvas.drawText(line, margin, y, paint);
                    y += lineHeight;
                }
                document.finishPage(page);
                try (FileOutputStream stream = new FileOutputStream(file)) {
                    document.writeTo(stream);
                }
                document.close();

                Uri uri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        file
                );
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("application/pdf");
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title == null ? "Sales Report PDF" : title);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(shareIntent, title == null ? "Share PDF" : title);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                runOnUiThread(() -> startActivity(chooser));
                return "Share opened";
            } catch (Exception error) {
                return "Share failed: " + error.getMessage();
            }
        }
    }
}
