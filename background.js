// data functions

// sync remote data to local if not yet done
// this is necessary because both the events in the background js
// and the sync storage API are async calls too
// and I wouldn't be able to pass data over from one to the other
// so during the calls I set both the local and the remote storage
// and I read only the local one which is always synced this way

function url_sync(){
  var flag = localStorage.getItem("sync");
  if (!flag){
    chrome.storage.sync.get("urls", function(data){
      var d = [];
      if (data){
        if (data.urls){
          d = data.urls;
          if (!localStorage.getItem("urls")){
            localStorage.setItem("urls", JSON.stringify(d));
            localStorage.setItem("sync", 1);
          }
        }
      }
    });
  }
}

function url_get(){
  var d = localStorage.getItem("urls");
  return (d ? JSON.parse(d) : []);
}

function url_test(url){
  var d = url_get();
  return (d.indexOf(url) > -1);
}

function url_set(url){
  if (!url_test(url)){
    var d = url_get();
    d.push(url);
    localStorage.setItem("urls", JSON.stringify(d));
    chrome.storage.sync.set({"urls": d});
  }
}

function url_remove(url){
  if (url_test(url)){
    var d = url_get();
    d.splice(d.indexOf(url), 1);
    localStorage.setItem("urls", JSON.stringify(d));
    chrome.storage.sync.set({"urls": d});
  }
}


// check if page is marked untrusted and set icons and return state
// according to it
function state(url, flag){
  var flag_untrusted = false;
  var flag_icon = false;

  if (url){
    // get domain part of the url
    var u2 = url.match(/:\/\/(.[^/]+)/);
    if (u2){
      var u = u2[1];

      // url exists? if so, it means page is marked untrusted
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

    // set toolbar icon
    if (flag_icon){
      chrome.browserAction.setIcon({path: "icons/icon2.svg"});
    }
    else{
      chrome.browserAction.setIcon({path: "icons/icon.svg"});
    }
  }

  return flag_untrusted;
}


// sync data
document.addEventListener("DOMContentLoaded", function(){
  url_sync();
}, false);


// mark page untrusted or trusted when icon is clicked
chrome.browserAction.onClicked.addListener(
  function(details){
    state(details.url, 1);
    chrome.tabs.reload({bypassCache: true});
  }
);


// update icon when switching tab based on whether page is trusted
chrome.tabs.onActivated.addListener(
  function(details){
    url_sync();
    chrome.tabs.query({currentWindow: true, active: true},
      function(tab){
        state(tab[0].url);
      }
    );
  }
);


// block scripts on page if url is marked untrsuted based on
// whether url exists in storage
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
