package com.massipro.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

// Este arquivo já existe depois de "npx cap add android". Substitua o conteúdo por este,
// ou só acrescente a linha registerPlugin(...) antes de super.onCreate(...).
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MassiPassosPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
