package __PACKAGE__;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.core.content.FileProvider;
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
  public SplitTrackUpdater(ReactApplicationContext context) { super(context); this.context = context; }
  @Override public String getName() { return "SplitTrackUpdater"; }
  private String digest(File file) throws Exception { MessageDigest sha = MessageDigest.getInstance("SHA-256"); try (InputStream in = new FileInputStream(file)) { byte[] buffer = new byte[65536]; int count; while ((count = in.read(buffer)) != -1) sha.update(buffer, 0, count); } StringBuilder hex = new StringBuilder(); for (byte b : sha.digest()) hex.append(String.format("%02x", b & 255)); return hex.toString(); }
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
    if (!address.startsWith("https://github.com/AdityaRoy999/splittrack-releases/releases/download/") || !address.endsWith(".apk") || !sha.matches("[a-f0-9]{64}") || expectedSize < 1 || expectedSize > 2147483648L) { promise.reject("INVALID_ARTIFACT", "This update has invalid artifact metadata."); return; }
    if (android.os.Build.VERSION.SDK_INT >= 26 && !context.getPackageManager().canRequestPackageInstalls()) {
      new Handler(Looper.getMainLooper()).post(() -> { try { context.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) {} promise.reject("INSTALL_PERMISSION", "Allow SplitTrack to install apps, then tap Download & install again."); }); return;
    }
    if (!busy.compareAndSet(false, true)) { promise.reject("BUSY", "An update is already being prepared."); return; }
    worker.execute(() -> {
      File part = null;
      try {
        File dir = new File(context.getCacheDir(), "splittrack-updates"); if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not prepare update storage.");
        File apk = new File(dir, sha + ".apk");
        if (!apk.exists() || apk.length() != (long) expectedSize || !digest(apk).equals(sha)) {
          part = new File(dir, sha + ".part"); HttpURLConnection c = connect(address);
          try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part)) { long size = 0; byte[] buffer = new byte[65536]; int count; while ((count = in.read(buffer)) != -1) { size += count; if (size > (long) expectedSize) throw new IOException("Download size does not match the release."); out.write(buffer, 0, count); } if (size != (long) expectedSize) throw new IOException("Incomplete update download."); } finally { c.disconnect(); }
          if (!digest(part).equals(sha)) throw new IOException("SHA-256 verification failed. This file will not be installed.");
          if (apk.exists() && !apk.delete()) throw new IOException("Could not replace the cached update.");
          if (!part.renameTo(apk)) throw new IOException("Could not save the verified update.");
        }
        PackageInfo info = context.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
        PackageInfo installed = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        if (info == null || !context.getPackageName().equals(info.packageName) || (android.os.Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode) <= (android.os.Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode)) throw new IOException("The APK is not a newer SplitTrack build.");
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".updates", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        new Handler(Looper.getMainLooper()).post(() -> { try { context.startActivity(intent); promise.resolve("INSTALLER_OPENED"); } catch (Exception e) { promise.reject("INSTALLER", "Android could not open the package installer."); } finally { busy.set(false); } });
      } catch (Exception e) { if (part != null) part.delete(); busy.set(false); promise.reject("UPDATE_FAILED", e.getMessage()); }
    });
  }
}
