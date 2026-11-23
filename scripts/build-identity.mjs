export function buildIdentity(platform, run, attempt) {
  if (!['android', 'ios'].includes(platform) || !Number.isSafeInteger(run) || run < 1 || !Number.isSafeInteger(attempt) || attempt < 1 || attempt > 99) throw new Error('Invalid workflow build identity.');
  const build = run * 100 + attempt;
  if (!Number.isSafeInteger(build) || build > 2147483647) throw new Error('Native build number is out of range.');
  return { build, tag: `splittrack-${platform}-${run}-attempt-${attempt}` };
}
