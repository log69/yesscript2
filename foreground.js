// sync remote data to local if not yet synced
var flag = localeStorage.get("sync");
if (!flag){
  localeStorage.set("url", chrome.storage.local.get("url") );
  localeStorage.set("sync", 1);
}

