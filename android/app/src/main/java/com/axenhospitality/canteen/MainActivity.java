package com.axenhospitality.canteen;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
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
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int BLUETOOTH_PERMISSION_REQUEST = 58;
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int RECEIPT_WIDTH = 384;
    private static final int RECEIPT_MARGIN = 2;

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
                writeChunked(output, text.getBytes(Charset.forName("UTF-8")));
                writeChunked(output, new byte[]{0x0A, 0x1D, 0x56, 0x01});
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
        public synchronized String printToPrinter(String address, String text) {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) throw new Exception("Bluetooth is off");

                Set<BluetoothDevice> devices = adapter.getBondedDevices();
                if (devices == null || devices.isEmpty()) throw new Exception("Pair the 58mm printer first");

                BluetoothDevice printer = printerForAddress(devices, address);
                writeReceiptToPrinter(adapter, printer, text);
                return "Print sent";
            } catch (Exception error) {
                return "Printer failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String printToPrinterAsync(String address, String text) {
            new Thread(() -> {
                try {
                    printToPrinter(address, text);
                } catch (Exception ignored) {}
            }).start();
            return "Print queued";
        }

        @JavascriptInterface
        public synchronized String printReceiptToPrinter(String address, String text, String logoDataUrl, String logoPosition, String headerName, String companyName) {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) throw new Exception("Bluetooth is off");

                Set<BluetoothDevice> devices = adapter.getBondedDevices();
                if (devices == null || devices.isEmpty()) throw new Exception("Pair the 58mm printer first");

                BluetoothDevice printer = printerForAddress(devices, address);
                writeReceiptToPrinter(adapter, printer, text, logoDataUrl, logoPosition, headerName, companyName);
                return "Print sent";
            } catch (Exception error) {
                return "Printer failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String printReceiptToPrinterAsync(String address, String text, String logoDataUrl, String logoPosition, String headerName, String companyName) {
            new Thread(() -> {
                try {
                    printReceiptToPrinter(address, text, logoDataUrl, logoPosition, headerName, companyName);
                } catch (Exception ignored) {}
            }).start();
            return "Print queued";
        }

        @JavascriptInterface
        public synchronized String printReceiptBitmapToPrinter(String address, String receiptJson) {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            try {
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) throw new Exception("Bluetooth is off");

                Set<BluetoothDevice> devices = adapter.getBondedDevices();
                if (devices == null || devices.isEmpty()) throw new Exception("Pair the 58mm printer first");

                BluetoothDevice printer = printerForAddress(devices, address);
                writeBitmapReceiptToPrinter(adapter, printer, receiptJson);
                return "Print sent";
            } catch (Exception error) {
                return "Printer failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String printReceiptBitmapToPrinterAsync(String address, String receiptJson) {
            new Thread(() -> {
                try {
                    printReceiptBitmapToPrinter(address, receiptJson);
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

        private BluetoothDevice printerForAddress(Set<BluetoothDevice> devices, String address) throws Exception {
            String targetAddress = address == null ? "" : address.trim();
            if (targetAddress.isEmpty()) return findPrinter(devices);
            for (BluetoothDevice device : devices) {
                if (targetAddress.equals(device.getAddress())) {
                    return device;
                }
            }
            throw new Exception("Selected printer not paired");
        }

        private void writeReceiptToPrinter(BluetoothAdapter adapter, BluetoothDevice printer, String text) throws Exception {
            writeReceiptToPrinter(adapter, printer, text, "", "above", "", "");
        }

        private void writeReceiptToPrinter(BluetoothAdapter adapter, BluetoothDevice printer, String text, String logoDataUrl, String logoPosition, String headerName, String companyName) throws Exception {
            BluetoothSocket targetSocket = null;
            OutputStream targetOutput = null;
            try {
                if (hasBluetoothScanPermission()) {
                    adapter.cancelDiscovery();
                }
                targetSocket = printer.createRfcommSocketToServiceRecord(SPP_UUID);
                targetSocket.connect();
                targetOutput = targetSocket.getOutputStream();
                targetOutput.write(new byte[]{0x1B, 0x40});
                Bitmap header = receiptHeaderBitmap(logoDataUrl, logoPosition, headerName, companyName, 100);
                if (header != null) {
                    writeRasterImage(targetOutput, header);
                    writeChunked(targetOutput, new byte[]{0x0A});
                }
                writeChunked(targetOutput, text.getBytes(Charset.forName("UTF-8")));
                writeChunked(targetOutput, new byte[]{0x0A, 0x1D, 0x56, 0x01});
                targetOutput.flush();
            } finally {
                try {
                    if (targetOutput != null) targetOutput.close();
                } catch (Exception ignored) {}
                try {
                    if (targetSocket != null) targetSocket.close();
                } catch (Exception ignored) {}
            }
        }

        private Bitmap receiptHeaderBitmap(String logoDataUrl, String logoPosition, String headerName, String companyName, int logoPercent) {
            Bitmap logo = decodeLogo(logoDataUrl);
            if (logo == null) return null;

            int width = RECEIPT_WIDTH;
            int scale = Math.max(60, Math.min(160, logoPercent));
            String position = logoPosition == null ? "above" : logoPosition.trim().toLowerCase();
            boolean topLogo = !"left".equals(position) && !"right".equals(position);
            int topLogoWidth = Math.max(84, Math.round(126 * scale / 100f));
            int topLogoHeight = Math.max(36, Math.round(70 * scale / 100f));
            int sideLogoSize = Math.max(48, Math.round(78 * scale / 100f));
            int height = topLogo ? topLogoHeight + 62 : Math.max(96, sideLogoSize + 12);
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);

            Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            textPaint.setColor(Color.BLACK);
            textPaint.setTextAlign(Paint.Align.CENTER);
            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            textPaint.setTextSize(30);

            Paint subPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            subPaint.setColor(Color.BLACK);
            subPaint.setTextAlign(Paint.Align.CENTER);
            subPaint.setTextSize(19);

            String title = cleanHeaderText(headerName, "SHAD KITCHEN").toUpperCase();
            String subtitle = cleanHeaderText(companyName, "axzen infotech");

            if ("left".equals(position) || "right".equals(position)) {
                int logoSize = Math.min(sideLogoSize, height - 10);
                int logoLeft = "right".equals(position) ? width - logoSize - RECEIPT_MARGIN : RECEIPT_MARGIN;
                int logoTop = Math.max(5, (height - logoSize) / 2);
                drawLogo(canvas, logo, logoLeft, logoTop, logoSize, logoSize);
                int textLeft = "right".equals(position) ? RECEIPT_MARGIN : logoLeft + logoSize + 6;
                int textRight = "right".equals(position) ? logoLeft - 6 : width - RECEIPT_MARGIN;
                int centerX = textLeft + ((textRight - textLeft) / 2);
                canvas.drawText(title, centerX, Math.max(38, (height / 2) - 7), textPaint);
                canvas.drawText(subtitle, centerX, Math.max(66, (height / 2) + 21), subPaint);
            } else {
                Rect logoRect = drawLogo(canvas, logo, (width - topLogoWidth) / 2, 0, topLogoWidth, topLogoHeight);
                canvas.drawText(title, width / 2, logoRect.bottom + 25, textPaint);
                canvas.drawText(subtitle, width / 2, logoRect.bottom + 51, subPaint);
            }
            return bitmap;
        }

        private Bitmap decodeLogo(String logoDataUrl) {
            if (logoDataUrl == null || logoDataUrl.trim().isEmpty()) return null;
            try {
                String base64 = logoDataUrl.contains(",") ? logoDataUrl.substring(logoDataUrl.indexOf(",") + 1) : logoDataUrl;
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            } catch (Exception ignored) {
                return null;
            }
        }

        private Rect drawLogo(Canvas canvas, Bitmap logo, int left, int top, int maxWidth, int maxHeight) {
            int sourceWidth = Math.max(1, logo.getWidth());
            int sourceHeight = Math.max(1, logo.getHeight());
            float scale = Math.min((float) maxWidth / sourceWidth, (float) maxHeight / sourceHeight);
            int drawWidth = Math.max(1, Math.round(sourceWidth * scale));
            int drawHeight = Math.max(1, Math.round(sourceHeight * scale));
            int drawLeft = left + ((maxWidth - drawWidth) / 2);
            int drawTop = top + Math.max(0, (maxHeight - drawHeight) / 4);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            Rect rect = new Rect(drawLeft, drawTop, drawLeft + drawWidth, drawTop + drawHeight);
            canvas.drawBitmap(logo, null, rect, paint);
            return rect;
        }

        private void writeRasterImage(OutputStream targetOutput, Bitmap bitmap) throws Exception {
            int width = bitmap.getWidth();
            int height = bitmap.getHeight();
            int widthBytes = (width + 7) / 8;
            byte[] imageBytes = new byte[widthBytes * height];
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int pixel = bitmap.getPixel(x, y);
                    int r = Color.red(pixel);
                    int g = Color.green(pixel);
                    int b = Color.blue(pixel);
                    int alpha = Color.alpha(pixel);
                    int luminance = (r * 299 + g * 587 + b * 114) / 1000;
                    if (alpha > 32 && luminance < 180) {
                        imageBytes[(y * widthBytes) + (x / 8)] |= (byte) (0x80 >> (x % 8));
                    }
                }
            }
            int bandRows = 192;
            for (int yStart = 0; yStart < height; yStart += bandRows) {
                int rows = Math.min(bandRows, height - yStart);
                byte[] command = new byte[]{0x1D, 0x76, 0x30, 0x00, (byte) (widthBytes & 0xFF), (byte) ((widthBytes >> 8) & 0xFF), (byte) (rows & 0xFF), (byte) ((rows >> 8) & 0xFF)};
                byte[] bandBytes = new byte[widthBytes * rows];
                System.arraycopy(imageBytes, yStart * widthBytes, bandBytes, 0, bandBytes.length);
                writeChunked(targetOutput, command);
                writeChunked(targetOutput, bandBytes);
                targetOutput.flush();
                Thread.sleep(6);
            }
        }

        private String cleanHeaderText(String value, String fallback) {
            String text = value == null ? "" : value.replaceAll("\\s+", " ").trim();
            return text.isEmpty() ? fallback : text;
        }

        private void writeBitmapReceiptToPrinter(BluetoothAdapter adapter, BluetoothDevice printer, String receiptJson) throws Exception {
            BluetoothSocket targetSocket = null;
            OutputStream targetOutput = null;
            try {
                if (hasBluetoothScanPermission()) {
                    adapter.cancelDiscovery();
                }
                targetSocket = printer.createRfcommSocketToServiceRecord(SPP_UUID);
                targetSocket.connect();
                targetOutput = targetSocket.getOutputStream();
                targetOutput.write(new byte[]{0x1B, 0x40});
                writeRasterImage(targetOutput, receiptBitmap(receiptJson));
                writeChunked(targetOutput, new byte[]{0x0A, 0x1D, 0x56, 0x01});
                targetOutput.flush();
            } finally {
                try {
                    if (targetOutput != null) targetOutput.close();
                } catch (Exception ignored) {}
                try {
                    if (targetSocket != null) targetSocket.close();
                } catch (Exception ignored) {}
            }
        }

        private Bitmap receiptBitmap(String receiptJson) throws Exception {
            JSONObject data = new JSONObject(receiptJson == null ? "{}" : receiptJson);
            JSONArray items = data.optJSONArray("items");
            int width = RECEIPT_WIDTH;
            int left = RECEIPT_MARGIN;
            int right = width - RECEIPT_MARGIN;
            int y = 4;
            int estimatedRows = items == null ? 0 : items.length() * 3;
            int height = 660 + (estimatedRows * 44);
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            canvas.drawColor(Color.WHITE);

            Paint title = receiptPaint(30, true, Paint.Align.CENTER);
            Paint sub = receiptPaint(20, false, Paint.Align.CENTER);
            Paint body = receiptPaint(21, false, Paint.Align.LEFT);
            Paint bodyRight = receiptPaint(21, false, Paint.Align.RIGHT);
            Paint itemPaint = receiptPaint(23, true, Paint.Align.LEFT);
            Paint footer = receiptPaint(22, true, Paint.Align.CENTER);
            Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            linePaint.setColor(Color.BLACK);
            linePaint.setStrokeWidth(2);

            Bitmap header = receiptHeaderBitmap(data.optString("logoDataUrl", ""), data.optString("logoPosition", "above"), data.optString("headerName", "SHAD KITCHEN"), data.optString("companyName", "axzen infotech"), data.optInt("logoSize", 100));
            if (header != null) {
                canvas.drawBitmap(header, 0, y, null);
                y += header.getHeight();
            } else {
                canvas.drawText(cleanHeaderText(data.optString("headerName", ""), "SHAD KITCHEN").toUpperCase(), width / 2, y + 30, title);
                canvas.drawText(cleanHeaderText(data.optString("companyName", ""), "axzen infotech"), width / 2, y + 60, sub);
                y += 70;
            }

            y = drawLine(canvas, linePaint, y, width);
            canvas.drawText("Date : " + data.optString("date", "-"), left, y + 24, body);
            canvas.drawText("Time : " + data.optString("time", "-"), right, y + 24, bodyRight);
            y += 34;
            canvas.drawText("Cashier : " + data.optString("cashier", "-"), left, y + 24, body);
            canvas.drawText("Token : " + data.optString("token", "-"), right, y + 24, bodyRight);
            y += 34;
            canvas.drawText("Payment : " + data.optString("payment", "Cash"), left, y + 24, body);
            y += 38;
            y = drawLine(canvas, linePaint, y, width);
            canvas.drawText("#  ITEM NAME", left, y + 25, body);
            canvas.drawText("QTY RATE AMT", right, y + 25, bodyRight);
            y += 36;
            y = drawLine(canvas, linePaint, y, width);

            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) continue;
                    String name = (i + 1) + " " + cleanHeaderText(item.optString("name", "Item"), "Item");
                    for (String line : wrapForPaint(name, itemPaint, width - (RECEIPT_MARGIN * 2))) {
                        canvas.drawText(line, left, y + 26, itemPaint);
                        y += 32;
                    }
                    double qty = item.optDouble("qty", 0);
                    double price = item.optDouble("price", 0);
                    String amount = trimNumber(qty) + " x " + moneyNumber(price) + " = " + moneyNumber(qty * price);
                    canvas.drawText(amount, right, y + 24, bodyRight);
                    y += 34;
                }
            }

            y = drawLine(canvas, linePaint, y, width);
            y = drawAmountRow(canvas, body, bodyRight, "SUBTOTAL", data.optDouble("subtotal", 0), y, width);
            y = drawAmountRow(canvas, body, bodyRight, "DISCOUNT", data.optDouble("discount", 0), y, width);
            y = drawLine(canvas, linePaint, y, width);
            y = drawAmountRow(canvas, receiptPaint(27, true, Paint.Align.LEFT), receiptPaint(27, true, Paint.Align.RIGHT), "TOTAL", data.optDouble("total", 0), y, width);
            y = drawLine(canvas, linePaint, y, width);
            canvas.drawText("THANK YOU! VISIT AGAIN", width / 2, y + 34, footer);
            y += 118;

            return Bitmap.createBitmap(bitmap, 0, 0, width, Math.min(height, y + 64));
        }

        private Paint receiptPaint(int size, boolean bold, Paint.Align align) {
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setColor(Color.BLACK);
            paint.setTextSize(size);
            paint.setTextAlign(align);
            paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, bold ? Typeface.BOLD : Typeface.NORMAL));
            return paint;
        }

        private int drawLine(Canvas canvas, Paint paint, int y, int width) {
            canvas.drawLine(RECEIPT_MARGIN, y + 5, width - RECEIPT_MARGIN, y + 5, paint);
            return y + 13;
        }

        private int drawAmountRow(Canvas canvas, Paint left, Paint right, String label, double value, int y, int width) {
            int baseline = y + Math.max(24, Math.round(left.getTextSize() + 2));
            canvas.drawText(label, RECEIPT_MARGIN, baseline, left);
            canvas.drawText("Rs " + moneyNumber(value), width - RECEIPT_MARGIN, baseline, right);
            return y + Math.max(32, Math.round(left.getTextSize() + 9));
        }

        private ArrayList<String> wrapForPaint(String text, Paint paint, int maxWidth) {
            ArrayList<String> lines = new ArrayList<>();
            String[] words = text.replaceAll("\\s+", " ").trim().split(" ");
            String current = "";
            for (String word : words) {
                String candidate = current.isEmpty() ? word : current + " " + word;
                if (paint.measureText(candidate) <= maxWidth) {
                    current = candidate;
                } else {
                    if (!current.isEmpty()) lines.add(current);
                    current = word;
                }
            }
            if (!current.isEmpty()) lines.add(current);
            if (lines.isEmpty()) lines.add("Item");
            return lines;
        }

        private String moneyNumber(double value) {
            return String.format(java.util.Locale.US, "%.2f", value);
        }

        private String trimNumber(double value) {
            if (Math.abs(value - Math.round(value)) < 0.001) {
                return String.valueOf((long) Math.round(value));
            }
            return String.format(java.util.Locale.US, "%.2f", value);
        }

        private void writeChunked(OutputStream targetOutput, byte[] bytes) throws Exception {
            int offset = 0;
            int chunkSize = 256;
            while (offset < bytes.length) {
                int count = Math.min(chunkSize, bytes.length - offset);
                targetOutput.write(bytes, offset, count);
                offset += count;
                if (offset % 2048 == 0 || offset >= bytes.length) {
                    targetOutput.flush();
                    Thread.sleep(8);
                }
            }
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
