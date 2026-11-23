package __PACKAGE__;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class SplitTrackInstallReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context, Intent intent) { if (intent != null && intent.getAction() != null) SplitTrackUpdater.installationStatus(intent); }
}
