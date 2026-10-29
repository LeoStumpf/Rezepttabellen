package de.leo.rezepttabellen;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Nimmt Text an, der aus einer anderen App geteilt wurde (z. B. ein Rezept-Link aus Chrome).
 * Beim Kaltstart holt das Web ihn mit holen(), läuft die App schon, kommt das Ereignis „geteilt“.
 */
@CapacitorPlugin(name = "TeilenEmpfang")
public class TeilenEmpfangPlugin extends Plugin {
    private String wartend;

    @Override
    public void load() {
        merken(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (merken(intent)) {
            JSObject daten = new JSObject();
            daten.put("text", wartend);
            notifyListeners("geteilt", daten, true);
        }
    }

    private boolean merken(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return false;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.isEmpty()) return false;
        wartend = text;
        // nicht bei jedem Neuaufbau der Activity erneut melden
        intent.setAction(Intent.ACTION_MAIN);
        return true;
    }

    @PluginMethod
    public void holen(PluginCall call) {
        JSObject daten = new JSObject();
        if (wartend != null) daten.put("text", wartend);
        wartend = null;
        call.resolve(daten);
    }
}
