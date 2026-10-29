package de.leo.rezepttabellen;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Öffnet den Android-Druckdialog für die aktuelle Seite (A4-Ansicht) – dort auch „Als PDF speichern“. */
@CapacitorPlugin(name = "Drucker")
public class DruckerPlugin extends Plugin {

    @PluginMethod
    public void drucken(PluginCall call) {
        String titel = call.getString("titel", "Rezept");
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(titel);
            PrintAttributes attrs = new PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build();
            pm.print(titel, adapter, attrs);
            call.resolve();
        });
    }
}
