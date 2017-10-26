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
      g_urls = array_merge_uniq(ldata.urls || [], g_urls);
      g_sync_local = true;
      url_store();
      url_sync_remote();
    });
  }
}

function url_sync_remote(){
  if (!g_sync_remote && chrome.storage.sync){
    chrome.storage.sync.get(function(sdata){
      if (sdata){
        g_urls = array_merge_uniq(sdata.urls || [], g_urls);
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


// check if page is marked untrusted and set icons and return state
//   according to it
function state(url, flag){
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

    // set toolbar state of icon
    if (flag_icon){
      chrome.browserAction.setIcon({path: "icons/icon2.svg"});
    }
    else{
      chrome.browserAction.setIcon({path: "icons/icon.svg"});
    }
  }

  return flag_untrusted;
}


// ******************** events ********************

// mark page untrusted or trusted when icon is clicked
chrome.browserAction.onClicked.addListener(
  function(details){
    state(details.url, 1);
    chrome.tabs.reload({bypassCache: true});
  }
);


// update icon state when switching tab
chrome.tabs.onActivated.addListener(
  function(details){
    // try to sync remote data from time to time on tab switch
    //   because the user might sign in the Sync service later only
    //   and I need to grab the remote data then
    url_sync_remote();

    chrome.tabs.query({currentWindow: true, active: true},
      function(tab){
        state(tab[0].url);
      }
    );
  }
);


// update icon state when the active page has finished loading
chrome.tabs.onUpdated.addListener(
  function(tabId, changeInfo, tab){
    if (tab.status == "complete" && tab.active) {
      state(tab.url);
    }
  }
);


// block scripts on page if url is marked untrsuted based on
//   whether url exists in storage
chrome.webRequest.onHeadersReceived.addListener(
  function(details){

    if (state(details.url)){

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
  {urls: ["<all_urls>"], types: ["main_frame"]},
  ["blocking", "responseHeaders"]
);


// ******************** init ********************

// sync data on startup
url_sync();
