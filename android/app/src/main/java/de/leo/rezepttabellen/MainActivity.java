package de.leo.rezepttabellen;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DruckerPlugin.class);
        registerPlugin(TeilenEmpfangPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
