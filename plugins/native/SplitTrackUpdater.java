package __PACKAGE__;
import android.content.Intent;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.pm.PackageInstaller;
import java.lang.ref.WeakReference;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
public class SplitTrackUpdater extends ReactContextBaseJavaModule {
  private final ReactApplicationContext context;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final AtomicBoolean busy = new AtomicBoolean(false);
  private static WeakReference<SplitTrackUpdater> active = new WeakReference<>(null);
  private final PackageInstaller installer;
  private volatile int sessionId = -1;
  private volatile boolean committed = false, reportedFailure = false;
  private volatile String updateSha = "", lastStage = "";
  private long lastEventAt = 0;
  private final PackageInstaller.SessionCallback callback = new PackageInstaller.SessionCallback() {
    @Override public void onCreated(int id) {}
    @Override public void onBadgingChanged(int id) {}
    @Override public void onActiveChanged(int id, boolean value) {}
    @Override public void onProgressChanged(int id, float progress) { if (id == sessionId && committed) emit("installing", progress * 100, null); }
    @Override public void onFinished(int id, boolean success) {
      if (id != sessionId) return; busy.set(false);
      if (success) emit("complete", 100, null);
      else if (!reportedFailure) emit("failed", 0, "Installation did not finish. Please try again.");
    }
  };
  public SplitTrackUpdater(ReactApplicationContext context) {
    super(context); this.context = context; installer = context.getPackageManager().getPackageInstaller();
    active = new WeakReference<>(this); installer.registerSessionCallback(callback, new Handler(Looper.getMainLooper()));
  }
  @ReactMethod public void addListener(String name) {}
  @ReactMethod public void removeListeners(double count) {}
  @Override public void invalidate() { installer.unregisterSessionCallback(callback); worker.shutdown(); super.invalidate(); }
  private synchronized void emit(String stage, double percent, String error) {
    long now = System.currentTimeMillis(); percent = Math.max(0, Math.min(100, Math.floor(percent)));
    if (stage.equals(lastStage) && now - lastEventAt < 250 && percent != 100 && error == null) return;
    lastStage = stage; lastEventAt = now;
    if (!context.hasActiveReactInstance()) return;
    WritableMap event = Arguments.createMap(); event.putString("stage", stage); event.putDouble("percent", percent); event.putString("sha256", updateSha);
    if (error != null) event.putString("message", error);
    context.emitDeviceEvent("SplitTrackUpdateProgress", event);
  }
  @Override public String getName() { return "SplitTrackUpdater"; }
  private String digest(File file) throws Exception {
    MessageDigest sha = MessageDigest.getInstance("SHA-256"); long read = 0; emit("verifying", 0, null);
    try (InputStream in = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int count; while ((count = in.read(buffer)) != -1) { sha.update(buffer, 0, count); read += count; emit("verifying", read * 100.0 / file.length(), null); } }
    StringBuilder hex = new StringBuilder(); for (byte value : sha.digest()) hex.append(String.format("%02x", value & 255)); return hex.toString();
  }
  private HttpURLConnection connect(String address) throws Exception {
    URL url = new URL(address);
    for (int redirects = 0; redirects < 8; redirects++) {
      String host = url.getHost();
      if (!url.getProtocol().equals("https") || !(host.equals("github.com") || host.endsWith(".githubusercontent.com"))) throw new IOException("Untrusted download redirect.");
      HttpURLConnection c = (HttpURLConnection) url.openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(false); c.setRequestProperty("Accept-Encoding", "identity");
      int status = c.getResponseCode();
      if (status >= 300 && status < 400) { String location = c.getHeaderField("Location"); URL next = new URL(url, location); c.disconnect(); url = next; continue; }
      if (status != 200) { c.disconnect(); throw new IOException("Download failed (HTTP " + status + ")."); }
      return c;
    }
    throw new IOException("Too many download redirects.");
  }
  @ReactMethod public void downloadAndInstall(String address, String sha, double expectedSize, Promise promise) {
    if (!address.startsWith("https://github.com/AdityaRoy999/splittrack-releases/releases/download/") || !address.endsWith(".apk") || !sha.matches("[a-f0-9]{64}") || !Double.isFinite(expectedSize) || expectedSize != Math.floor(expectedSize) || expectedSize < 1 || expectedSize > 2147483648L) { promise.reject("INVALID_ARTIFACT", "This update has invalid artifact metadata."); return; }
    if (android.os.Build.VERSION.SDK_INT >= 26 && !context.getPackageManager().canRequestPackageInstalls()) {
      new Handler(Looper.getMainLooper()).post(() -> { try { context.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {} promise.reject("INSTALL_PERMISSION", "Allow SplitTrack to install apps, then tap Download & install again."); }); return;
    }
    if (!busy.compareAndSet(false, true)) { promise.reject("BUSY", "An update is already being prepared."); return; }
    updateSha = sha; lastStage = ""; committed = false; reportedFailure = false; sessionId = -1;
    worker.execute(() -> {
      File part = null;
      try {
        File dir = new File(context.getCacheDir(), "splittrack-updates"); if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not prepare update storage.");
        File apk = new File(dir, sha + ".apk");
        if (!apk.exists() || apk.length() != (long) expectedSize || !digest(apk).equals(sha)) {
          emit("downloading", 0, null); part = new File(dir, sha + ".part"); HttpURLConnection c = connect(address);
          try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part)) { long size = 0; byte[] buffer = new byte[65536]; int count; while ((count = in.read(buffer)) != -1) { size += count; if (size > (long) expectedSize) throw new IOException("Download size does not match the release."); out.write(buffer, 0, count); emit("downloading", size * 100.0 / expectedSize, null); } if (size != (long) expectedSize) throw new IOException("Incomplete update download."); } finally { c.disconnect(); }
          if (!digest(part).equals(sha)) throw new IOException("SHA-256 verification failed. This file will not be installed.");
          if (apk.exists() && !apk.delete()) throw new IOException("Could not replace the cached update.");
          if (!part.renameTo(apk)) throw new IOException("Could not save the verified update.");
        }
        PackageInfo info = context.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
        PackageInfo installed = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        if (info == null || !context.getPackageName().equals(info.packageName) || (android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode) <= (android.os.Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode)) throw new IOException("The APK is not a newer SplitTrack build.");
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(context.getPackageName()); params.setSize(apk.length()); sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
          emit("preparing_install", 0, null);
          try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
            byte[] buffer = new byte[65536]; int count; long copied = 0;
            while ((count = in.read(buffer)) != -1) { out.write(buffer, 0, count); copied += count; session.setStagingProgress((float) copied / apk.length()); emit("preparing_install", copied * 100.0 / apk.length(), null); }
            session.fsync(out);
          }
          Intent result = new Intent(context, SplitTrackInstallReceiver.class).setAction(context.getPackageName() + ".UPDATE_STATUS").putExtra("update_session", sessionId);
          int flags = PendingIntent.FLAG_UPDATE_CURRENT | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
          PendingIntent pending = PendingIntent.getBroadcast(context, sessionId, result, flags);
          session.commit(pending.getIntentSender()); committed = true;
          PackageInstaller.SessionInfo state = installer.getSessionInfo(sessionId); emit("installing", state == null ? 0 : state.getProgress() * 100, null);
        }
        promise.resolve("INSTALL_REQUESTED");
      } catch (Exception e) { if (part != null) part.delete(); if (sessionId >= 0 && !committed) try { installer.abandonSession(sessionId); } catch (Exception ignored) {} reportedFailure = true; busy.set(false); emit("failed", 0, e.getMessage()); promise.reject("UPDATE_FAILED", e.getMessage()); }
    });
  }
  static void installationStatus(Intent intent) {
    SplitTrackUpdater module = active.get(); if (module == null || !intent.getAction().equals(module.context.getPackageName() + ".UPDATE_STATUS")) return;
    int id = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, intent.getIntExtra("update_session", -1)); if (id != module.sessionId) return;
    int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      Intent confirmation = intent.getParcelableExtra(Intent.EXTRA_INTENT); module.emit("awaiting_confirmation", 0, null);
      try {
        if (confirmation == null) throw new IOException("Missing installation confirmation.");
        Activity activity = module.context.getCurrentActivity();
        if (activity != null && !activity.isFinishing()) activity.startActivity(confirmation);
        else module.context.startActivity(confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      } catch (Exception error) { module.reportedFailure = true; module.busy.set(false); module.emit("failed", 0, "Android could not open installation confirmation. Please try again."); try { module.installer.abandonSession(id); } catch (Exception ignored) {} }
    } else if (status == PackageInstaller.STATUS_SUCCESS) { module.busy.set(false); module.emit("complete", 100, null); }
    else { module.reportedFailure = true; module.busy.set(false); module.emit("failed", 0, status == PackageInstaller.STATUS_FAILURE_ABORTED ? "Installation was cancelled. Tap to try again." : intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)); }
  }
}
