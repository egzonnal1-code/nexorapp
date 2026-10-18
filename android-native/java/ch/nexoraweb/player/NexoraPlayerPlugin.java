package ch.nexoraweb.player;

import android.app.Activity;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * NEXORA – luajtësi vendas i Android-it (ExoPlayer / Media3).
 * Luan HEVC/4K dhe zë Dolby (AC3/E-AC3) me dekoderin e pajisjes.
 * Pamja e videos vendoset mbi WebView, në drejtkëndëshin që i jep JavaScript-i.
 */
@OptIn(markerClass = UnstableApi.class)
@CapacitorPlugin(name = "NexoraPlayer")
public class NexoraPlayerPlugin extends Plugin {
    private static final String UA = "VLC/3.0.20 LibVLC/3.0.20";
    private static final int MAX_RETRIES = 5;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private FrameLayout box;
    private PlayerView view;
    private TextView label;

    private MediaItem current;
    private boolean live;
    private boolean everReady;
    private boolean visible;
    private int retries;
    private int gen;

    private interface Ui { void run(); }

    private void ui(Ui r) {
        Activity a = getActivity();
        if (a == null) return;
        a.runOnUiThread(() -> { try { r.run(); } catch (Throwable t) { /* mos e rrëzo programin */ } });
    }

    private void ensure() {
        if (player != null) return;
        Activity a = getActivity();

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(UA)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(10000)
                .setReadTimeoutMs(15000);
        DefaultExtractorsFactory extractors = new DefaultExtractorsFactory()
                .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES
                        | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS);
        DefaultMediaSourceFactory sources = new DefaultMediaSourceFactory(new DefaultDataSource.Factory(a, http), extractors);

        // Fillon pas 1 sekonde video në rezervë, mban deri në 50 s – nis shpejt dhe ngec rrallë
        DefaultLoadControl load = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(15000, 50000, 1000, 3000)
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();

        DefaultRenderersFactory renderers = new DefaultRenderersFactory(a)
                .setEnableDecoderFallback(true);

        DefaultTrackSelector tracks = new DefaultTrackSelector(a);
        tracks.setParameters(tracks.buildUponParameters()
                .setExceedRendererCapabilitiesIfNecessary(true)
                .setExceedVideoConstraintsIfNecessary(true)
                .setExceedAudioConstraintsIfNecessary(true));

        player = new ExoPlayer.Builder(a, renderers)
                .setMediaSourceFactory(sources)
                .setLoadControl(load)
                .setTrackSelector(tracks)
                .setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(C.USAGE_MEDIA)
                        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                        .build(), true)
                .build();
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) {
                    if (!everReady) { everReady = true; notifyListeners("ready", new JSObject()); }
                    retries = 0;
                    setLabel(null);
                } else if (state == Player.STATE_ENDED) {
                    if (live) retry(null); else notifyListeners("ended", new JSObject());
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException e) {
                if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    player.seekToDefaultPosition();
                    player.prepare();
                    return;
                }
                if (everReady && live && retries < MAX_RETRIES) { retry(e); return; }
                JSObject o = new JSObject();
                o.put("code", e.getErrorCodeName());
                o.put("http", httpCode(e));
                o.put("message", String.valueOf(e.getMessage()));
                notifyListeners("error", o);
            }
        });

        view = new PlayerView(a);
        view.setPlayer(player);
        view.setUseController(false);
        view.setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS);
        view.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
        view.setKeepContentOnPlayerReset(false);
        view.setBackgroundColor(Color.BLACK);
        view.setShutterBackgroundColor(Color.BLACK);
        view.setFocusable(false);
        view.setOnClickListener(clicker);

        label = new TextView(a);
        label.setTextColor(Color.WHITE);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        label.setBackgroundColor(0xB3000000);
        int pad = dp(10);
        label.setPadding(pad * 2, pad, pad * 2, pad);
        label.setVisibility(View.GONE);

        box = new FrameLayout(a);
        box.setBackgroundColor(Color.BLACK);
        box.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        lp.bottomMargin = dp(24);
        box.addView(label, lp);
        box.setVisibility(View.GONE);
        root().addView(box, new FrameLayout.LayoutParams(1, 1));
    }

    private final View.OnClickListener clicker = v -> notifyListeners("click", new JSObject());

    private ViewGroup root() { return getActivity().findViewById(android.R.id.content); }

    private int dp(int v) { return Math.round(v * getActivity().getResources().getDisplayMetrics().density); }

    private static int httpCode(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof HttpDataSource.InvalidResponseCodeException) return ((HttpDataSource.InvalidResponseCodeException) t).responseCode;
        }
        return 0;
    }

    private void retry(PlaybackException e) {
        retries++;
        final int g = gen;
        JSObject o = new JSObject();
        o.put("attempt", retries);
        o.put("max", MAX_RETRIES);
        notifyListeners("retry", o);
        handler.postDelayed(() -> {
            if (g != gen || player == null || current == null) return;
            player.setMediaItem(current);
            player.prepare();
            player.play();
        }, Math.min(1500L * retries, 8000L));
    }

    private void setLabel(String text) {
        if (label == null) return;
        if (text == null || text.isEmpty()) { label.setVisibility(View.GONE); return; }
        label.setText(text);
        label.setVisibility(View.VISIBLE);
    }

    private void applyRect(PluginCall call) {
        if (box == null) return;
        visible = call.getBoolean("visible", true);
        if (!visible) { box.setVisibility(View.GONE); return; }
        FrameLayout.LayoutParams lp;
        if (call.getBoolean("full", false)) {
            lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        } else {
            WebView wv = getBridge().getWebView();
            float scale = wv.getScale();
            if (scale <= 0) scale = getActivity().getResources().getDisplayMetrics().density;
            int[] w = new int[2];
            int[] r = new int[2];
            wv.getLocationInWindow(w);
            root().getLocationInWindow(r);
            double x = call.getDouble("x", 0.0), y = call.getDouble("y", 0.0);
            double width = call.getDouble("w", 0.0), height = call.getDouble("h", 0.0);
            lp = new FrameLayout.LayoutParams((int) Math.max(1, Math.round(width * scale)), (int) Math.max(1, Math.round(height * scale)));
            lp.leftMargin = (int) Math.round(x * scale) + w[0] - r[0];
            lp.topMargin = (int) Math.round(y * scale) + w[1] - r[1];
            lp.gravity = Gravity.TOP | Gravity.START;
        }
        box.setLayoutParams(lp);
        box.setVisibility(View.VISIBLE);
        box.bringToFront();
    }

    @PluginMethod
    public void play(PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("url"); return; }
        ui(() -> {
            ensure();
            gen++;
            handler.removeCallbacksAndMessages(null);
            live = call.getBoolean("live", true);
            everReady = false;
            retries = 0;
            MediaItem.Builder b = new MediaItem.Builder().setUri(url);
            if (call.getBoolean("hls", false)) b.setMimeType(MimeTypes.APPLICATION_M3U8);
            current = b.build();
            player.stop();
            player.setMediaItem(current);
            player.prepare();
            player.setPlayWhenReady(true);

            boolean controls = call.getBoolean("controls", false);
            view.setUseController(controls);
            if (controls) {
                view.setOnClickListener(null);
                view.setFocusable(true);
                view.setFocusableInTouchMode(true);
            } else {
                view.hideController();
                view.setOnClickListener(clicker);
                view.setFocusable(false);
                view.setFocusableInTouchMode(false);
            }
            setLabel(null);
            applyRect(call);
            if (controls) { view.requestFocus(); view.showController(); }
            else getBridge().getWebView().requestFocus();
            getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @PluginMethod
    public void setRect(PluginCall call) {
        ui(() -> { if (box != null && current != null) applyRect(call); call.resolve(); });
    }

    @PluginMethod
    public void setText(PluginCall call) {
        ui(() -> { setLabel(call.getString("text", "")); call.resolve(); });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        ui(() -> {
            gen++;
            handler.removeCallbacksAndMessages(null);
            current = null;
            if (player != null) { player.stop(); player.clearMediaItems(); }
            if (box != null) {
                boolean hadFocus = view.hasFocus();
                box.setVisibility(View.GONE);
                setLabel(null);
                if (hadFocus) getBridge().getWebView().requestFocus();
            }
            getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    @Override
    protected void handleOnPause() {
        if (player != null) player.pause();
    }

    @Override
    protected void handleOnResume() {
        if (player != null && current != null) {
            if (live) { player.seekToDefaultPosition(); player.prepare(); }
            player.play();
        }
    }

    @Override
    protected void handleOnDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) { player.release(); player = null; }
    }
}
