package ch.nexoraweb.player;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NexoraPlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
