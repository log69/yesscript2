
// -----------------------------------------------------------------
// -------------------- YesScript2 webextension --------------------
// -----------------------------------------------------------------
// copyright (C) 2017 Andras Horvath <mail@log69.com>
// license: MIT
// info: blocks scripts on sites, there are 3 states:
//   1)   no blocking (website is untouched)
//   2) half blocking (allowing internal and blocking external)
//   3) full blocking (blocking internal and external too)
//   page is reloaded automatically after every click


// ******************** global variables ********************

// holds a list of blocked urls
// ?domain.com means half blocking (allowing self and inline scripts)
// domain.com means full blocking
var g_urls  = [];
var g_urls2 = [];
// true if data is loaded from local storage
var g_sync_local  = false;
// true if data is loaded from remote storage
var g_sync_remote = false;


// ******************** array functions ********************

// ??domain.com and ?domain.com and domain.com are considered the same
function array_uniq(a){
  var b = [];
  for (var i in a) {
    var x = a[i];
    var y = x;
    if (x[0] == "?" && x[1] == "?"){ y = x.substr(2, x.length-1); }
    else if           (x[0] == "?"){ y = x.substr(1, x.length-1); }
    if ( b.indexOf(y) < 0
      && b.indexOf("?" + y) < 0
      && b.indexOf("??" + y) < 0){
      b.push(x);
    }
  }
  return b;
}

// merge arrays and uniq and sort
function array_merge(a, b){
  return array_uniq(a.concat(b)).sort();
}


// ******************** sync functions ********************

function debug(obj, text){ console.log("DEBUG / "
  + text.toString() + " / " + JSON.stringify(obj)); }


// load local data and sync with remote if available by merging them
function url_sync(){
  if (!g_sync_local){
    chrome.storage.local.get(function(ldata){
      if (ldata && typeof ldata.urls != "undefined"){
        g_urls = array_merge(ldata.urls, g_urls);
      }
      g_sync_local = true;
      url_sync_remote();
    });
  }
  else {
    url_sync_remote();
  }
}

function url_sync_remote(){
  // need to test for sync object because it's not available on mobile
  if (chrome.storage.sync){
    // continuously keep fetching remote data from sync if any
    //   and merge it with local one because we cannot know
    //   when user will log in and when data will be available
    chrome.storage.sync.get(function(sdata){
      if (sdata && typeof sdata.urls != "undefined"){
        g_urls = array_merge(g_urls, sdata.urls);
      }
    });
  }
  url_store();
}

function url_store(){
  // storing data when changed only helps keep the number of writes down
  //   to avoid reaching a limit in sync writes
  if (JSON.stringify(g_urls2) != JSON.stringify(g_urls)){
    g_urls2 = g_urls;

    if (g_sync_local){ chrome.storage.local.set({"urls": g_urls}); }
    chrome.storage.sync.set({"urls": g_urls});
  }
}


// ******************** url functions ********************

// is domain blocked? (empty means ??domain.com)
//   ??domain.com (1) = no
//    ?domain.com (2) = half
//     domain.com (3) = full
function url_test(u){
  // default value for empty (no dmain name is stored)
  var res = 1;
       if (g_urls.indexOf("??" + u) > -1){ res = 1; }
  else if (g_urls.indexOf("?"  + u) > -1){ res = 2; }
  else if (g_urls.indexOf(       u) > -1){ res = 3; }
  return res;
}

// switch to next state (no -> half -> full)
function url_next_state(u){
  var t = url_test(u);
  if (t == 2){
    g_urls[g_urls.indexOf("?" + u)] = u;
  }
  else if (t == 3){
    g_urls[g_urls.indexOf(u)] = "??" + u;
  }
  else{
    if (g_urls.indexOf("??" + u) > -1){
      g_urls[g_urls.indexOf("??" + u)] = "?" + u;
    } else {
      g_urls.push("?" + u);
    }
  }
}

function set_icon(flag){
  // browserAction.setIcon function is not available on mobile
  //   so check it first
  if (chrome.browserAction.setIcon){
    p = "icons/icon.svg";
    if (flag == 2){ p = "icons/icon2.svg"; }
    if (flag == 3){ p = "icons/icon3.svg"; }
    chrome.browserAction.setIcon({path: p});
  }
  // set tooltip for button on desktop and menu entry name on mobile
  t = "YesScript2 no blocking";
  if (flag == 2){ t = "YesScript2 half blocking"; }
  if (flag == 3){ t = "YesScript2 full blocking"; }
  chrome.browserAction.setTitle({title: t});
}


// check if page is marked untrusted and set icons and return status
//   according to it
// status of false means no blocking, 2 means half, 3 means full
function status(url, flag_clicked){
  var flag_state = false;
  var flag_icon  = false;

  if (url){
    // get domain part of the url
    var u2 = url.match(/:\/\/(.[^/]+)/);
    if (u2){
      var u = u2[1];

      // was there any click? toggle state of domain if so
      if (flag_clicked){ url_next_state(u); }

      // url exists? if so, it means page is untrusted
      flag_state = url_test(u);
      flag_icon  = flag_state;
    }

    // set state of toolbar icon
    set_icon(flag_icon);
  }

  return flag_state;
}


// ******************** events ********************

// mark page untrusted or trusted when icon is clicked
chrome.browserAction.onClicked.addListener(
  function(details){
    status(details.url, 1);
    chrome.tabs.reload({bypassCache: true});
  }
);


// update when switching tabs
chrome.tabs.onActivated.addListener(
  function(details){
    // try to sync remote data from time to time on tab switch
    //   because the user might sign in the Sync service later only
    //   and I need to grab the remote data then
    url_sync();

    chrome.tabs.query({currentWindow: true, active: true},
      function(tabs){
        status(tabs[0].url);
      }
    );
  }
);


// this is a check for mobile platform because it has no windows
if (chrome.windows){
  // update when switching windows
  chrome.windows.onFocusChanged.addListener(
    function(winid){
      if (winid != chrome.windows.WINDOW_ID_NONE){
        chrome.tabs.query({windowId: winid, active: true},
          function(tabs){
            if (typeof tabs != "undefined"){
              if (typeof tabs[0] != "undefined"){
                status(tabs[0].url);
              }
            }
          }
        );
      }
    }
  );
}


// update when active page has finished loading
chrome.tabs.onUpdated.addListener(
  function(tabId, changeInfo, tab){
    if (tab.status == "complete" && tab.active) {
      url_sync();
      status(tab.url);
    }
  }
);


// block scripts on page if url is marked untrsuted based on
//   whether url exists in storage
// blocking can be half blocking (green icon) or full (red icon)
//   half means that all scripts are blocked except the ones from domain
//   full means that all scripts are blocked entirely
// include the original response header merging the two arrays
// the trick of blocking all scripts for a domain is
//   adding CSP to the page header
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
// https://content-security-policy.com
chrome.webRequest.onHeadersReceived.addListener(
  function(details){
    var s = status(details.url);

    // half blocking?
    if (s == 2){
      var rh = details.responseHeaders.concat(
        [{name: "Content-Security-Policy",
          value: "script-src 'self' 'unsafe-inline'"}]
      );
      return {responseHeaders: rh};
    }

    // full blocking?
    if (s == 3){
      var rh = details.responseHeaders.concat(
        [{name: "Content-Security-Policy",
          value: "script-src 'none'"}]
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

