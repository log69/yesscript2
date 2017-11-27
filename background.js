
// ******************** global variables ********************

// holds a list of blocked urls
var g_urls = [];
// true if data is loaded from local storage
var g_sync_local  = false;
// true if data is loaded from remote storage
var g_sync_remote = false;


// ******************** array functions ********************

function array_uniq(a){
  return a.filter(function (e, i, a) {
    return a.lastIndexOf(e) === i;
  }).sort();
}

function array_merge_uniq(a, b){
  return array_uniq(a).concat(
    array_uniq(b).filter(function (x){
      return a.indexOf(x) < 0;
    })
  ).sort();
}


// ******************** sync functions ********************

// load local data and sync with remote if available by merging them
function url_sync(){
  if (!g_sync_local){
    chrome.storage.local.get(function(ldata){
      if (typeof ldata.urls != "undefined"){
        g_urls = array_merge_uniq(ldata.urls || [], g_urls);
      }
      g_sync_local = true;
      url_store();
      url_sync_remote();
    });
  }
}

function url_sync_remote(){
  if (!g_sync_remote && chrome.storage.sync){
    chrome.storage.sync.get(function(sdata){
      if (sdata && typeof sdata.urls != "undefined"){
        g_urls = array_merge_uniq(sdata.urls, g_urls);
        g_sync_remote = true;
        url_store();
      }
    });
  }
}

function url_store(){
  if (g_sync_local){ chrome.storage.local.set({urls: g_urls}); }
  if (g_sync_remote){ chrome.storage.sync.set({urls: g_urls}); }
}


// ******************** url functions ********************

function url_test(u){
  return g_urls.indexOf(u) > -1;
}

function url_set(u){
  if (!url_test(u)){
    g_urls.push(u);
    url_store();
  }
}

function url_remove(u){
  if (url_test(u)){
    g_urls.splice(g_urls.indexOf(u), 1);
    url_store();
  }
}

function set_icon(flag, tabid){
  // browserAction.setIcon function is not available on mobile
  //   so check it first
  if (chrome.browserAction.setIcon){
    p = flag ? "icons/icon2.svg" : "icons/icon.svg"
    chrome.browserAction.setIcon({path: p});
  }
  // set tooltip for button on desktop and menu entry name on mobile
  if (tabid){
    t = flag ? "YesScript2 blocking" : "YesScript2"
    chrome.browserAction.setTitle({title: t, tabId: tabid});
  }
}


// check if page is marked untrusted and set icons and return status
//   according to it
function status(url, flag, tabid){
  var flag_untrusted = false;
  var flag_icon = false;

  if (url){
    // get domain part of the url
    var u2 = url.match(/:\/\/(.[^/]+)/);
    if (u2){
      var u = u2[1];

      // url exists? if so, it means page is untrusted
      flag_untrusted = url_test(u);
      if (!flag_untrusted){
        if (flag){
          // mark page untrusted if icon was clicked
          url_set(u);
        }
        flag_icon = flag;
      }
      else{
        if (flag){
          // mark page trusted if icon was clicked
          url_remove(u);
        }
        flag_icon = !flag;
      }
    }

    // set state of toolbar icon
    set_icon(flag_icon, tabid)
  }

  return flag_untrusted;
}


// ******************** events ********************

// mark page untrusted or trusted when icon is clicked
chrome.browserAction.onClicked.addListener(
  function(details){
    status(details.url, 1);
    chrome.tabs.reload({bypassCache: true});
  }
);


// update icon and check status when switching tabs
chrome.tabs.onActivated.addListener(
  function(details){
    // try to sync remote data from time to time on tab switch
    //   because the user might sign in the Sync service later only
    //   and I need to grab the remote data then
    url_sync_remote();

    chrome.tabs.query({currentWindow: true, active: true},
      function(tabs){
        status(tabs[0].url, null, tabs[0].id);
      }
    );
  }
);


// this is a check for mobile platform because it has no windows
if (chrome.windows){
  // update icon and check status when switching windows
  chrome.windows.onFocusChanged.addListener(
    function(winid){
      if (winid != chrome.windows.WINDOW_ID_NONE){
        chrome.tabs.query({windowId: winid, active: true},
          function(tabs){
            if (typeof tabs != "undefined"){
              if (typeof tabs[0] != "undefined"){
                status(tabs[0].url, null, tabs[0].id);
              }
            }
          }
        );
      }
    }
  );
}


// update icon and check status when the active page has finished loading
chrome.tabs.onUpdated.addListener(
  function(tabId, changeInfo, tab){
    if (tab.status == "complete" && tab.active) {
      url_sync_remote();
      status(tab.url, null, tab.id);
    }
  }
);


// block scripts on page if url is marked untrsuted based on
//   whether url exists in storage
chrome.webRequest.onHeadersReceived.addListener(
  function(details){

    if (status(details.url)){

      // include the original response header too
      //   merging the two arrays here
      // the trick of blocking all scripts for a domain is
      //   adding CSP to the page header
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
      var rh = details.responseHeaders.concat(
        [{name: "Content-Security-Policy", value: "script-src 'none'"}]
      );
      return {responseHeaders: rh};
    }

    return {};
  },
  {urls: ["<all_urls>"], types: ["main_frame", "sub_frame"]},
  ["blocking", "responseHeaders"]
);


// ******************** init ********************

// sync data on startup
url_sync();
