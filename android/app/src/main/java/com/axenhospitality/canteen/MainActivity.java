package com.axenhospitality.canteen;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import com.getcapacitor.BridgeActivity;
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
    }

    private void applySystemBars() {
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
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
        @JavascriptInterface
        public String wake() {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) return "Bluetooth is off";

            Set<BluetoothDevice> devices = adapter.getBondedDevices();
            if (devices == null || devices.isEmpty()) return "Pair the 58mm printer first";

            BluetoothDevice printer = findPrinter(devices);
            try (BluetoothSocket socket = printer.createRfcommSocketToServiceRecord(SPP_UUID)) {
                if (hasBluetoothScanPermission()) {
                    adapter.cancelDiscovery();
                }
                socket.connect();
                OutputStream output = socket.getOutputStream();
                output.write(new byte[]{0x1B, 0x40});
                output.flush();
                return "Printer ready";
            } catch (Exception error) {
                return "Printer failed: " + error.getMessage();
            }
        }

        @JavascriptInterface
        public String print(String text) {
            if (!hasBluetoothPermission()) {
                requestBluetoothPermission();
                return "Bluetooth permission needed";
            }

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) return "Bluetooth is off";

            Set<BluetoothDevice> devices = adapter.getBondedDevices();
            if (devices == null || devices.isEmpty()) return "Pair the 58mm printer first";

            BluetoothDevice printer = findPrinter(devices);

            try (BluetoothSocket socket = printer.createRfcommSocketToServiceRecord(SPP_UUID)) {
                if (hasBluetoothScanPermission()) {
                    adapter.cancelDiscovery();
                }
                socket.connect();
                OutputStream output = socket.getOutputStream();
                output.write(new byte[]{0x1B, 0x40});
                output.write(text.getBytes(Charset.forName("UTF-8")));
                output.write(new byte[]{0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x01});
                output.flush();
                return "Print sent";
            } catch (Exception error) {
                return "Printer failed: " + error.getMessage();
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
    }
}
