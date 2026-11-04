package com.massipro.app;

import android.Manifest;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Plugin MassiPassos: lê o contador de passos do Android (TYPE_STEP_COUNTER).
 *
 * O sensor é contado pelo próprio celular, mesmo com a tela apagada e o app fechado. Ele devolve o
 * total de passos desde que o celular ligou. O app só pergunta esse total quando é aberto
 * (a conta do dia é feita em src/passos/contagemSensor.js). Por isso não há serviço em segundo plano.
 *
 * Comandos chamados pelo JavaScript (src/passos/ponte.js):
 *   estado()         -> { sensor, permitido }
 *   pedirPermissao() -> { permitido }
 *   lerContador()    -> { valor }
 */
@CapacitorPlugin(
    name = "MassiPassos",
    permissions = {
        @Permission(alias = "atividade", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class MassiPassosPlugin extends Plugin {

    private static final long TEMPO_LIMITE_MS = 4000;

    private SensorManager gerenteSensores() {
        return (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
    }

    private Sensor sensorPassos() {
        SensorManager sm = gerenteSensores();
        return sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }

    // A permissão ACTIVITY_RECOGNITION só é pedida em tempo de execução a partir do Android 10 (API 29).
    private boolean permitido() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return getPermissionState("atividade") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject();
        r.put("sensor", sensorPassos() != null);
        r.put("permitido", permitido());
        call.resolve(r);
    }

    @PluginMethod
    public void pedirPermissao(PluginCall call) {
        if (permitido()) {
            responderPermissao(call);
            return;
        }
        requestPermissionForAlias("atividade", call, "retornoPermissao");
    }

    @PermissionCallback
    private void retornoPermissao(PluginCall call) {
        responderPermissao(call);
    }

    private void responderPermissao(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permitido", permitido());
        call.resolve(r);
    }

    @PluginMethod
    public void lerContador(PluginCall call) {
        final Sensor sensor = sensorPassos();
        if (sensor == null) {
            call.reject("sem_sensor");
            return;
        }
        if (!permitido()) {
            call.reject("sem_permissao");
            return;
        }
        final SensorManager sm = gerenteSensores();
        final Handler handler = new Handler(Looper.getMainLooper());
        final boolean[] terminou = { false };
        final SensorEventListener[] ouvinte = new SensorEventListener[1];

        final Runnable estouro = new Runnable() {
            @Override
            public void run() {
                if (terminou[0]) return;
                terminou[0] = true;
                sm.unregisterListener(ouvinte[0]);
                call.reject("sem_leitura");
            }
        };

        ouvinte[0] = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (terminou[0]) return;
                terminou[0] = true;
                handler.removeCallbacks(estouro);
                sm.unregisterListener(this);
                JSObject r = new JSObject();
                r.put("valor", (long) event.values[0]);
                call.resolve(r);
            }

            @Override
            public void onAccuracyChanged(Sensor s, int precisao) { }
        };

        boolean registrou = sm.registerListener(ouvinte[0], sensor, SensorManager.SENSOR_DELAY_NORMAL);
        if (!registrou) {
            terminou[0] = true;
            call.reject("sem_leitura");
            return;
        }
        handler.postDelayed(estouro, TEMPO_LIMITE_MS);
    }
}
