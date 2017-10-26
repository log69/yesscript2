/* -------------------- Prototypes -------------------- */

//Returns true if array contains val
Array.prototype.contains = function(val){
	return (this.indexOf(val)>=0);
};

//Removes first element that fulfills condition
Array.prototype.remove = function(callback){
	var index = this.findIndex(callback);
	return (index>=0)?this.splice(index,1)[0]:null;
};

/* -------------------- Class JSBlocker -------------------- */

function JSBlocker(){
	this.urls = [];
	this.current = null;
	this.trust = false;
	var self = this;
	var syncing = false;
	
	//Retrieves data from local storage and from sync storage if available
	browser.storage.local.get(function(storage){
		self.urls = storage.urls || [];
		if(browser.storage.sync) syncstorage();
	});
	
	//Gets current url from focused tab
	browser.tabs.query({currentWindow: true, active: true},function(tabs){
		if(tabs.length) self.setcurrent(tabs[0].url);
	});
	
	//Private methods
	var syncstorage = function(){
		browser.storage.sync.get(function(storage){
			if(storage && storage.urls){
				self.urls = storage.urls;
				browser.storage.local.set({urls: self.urls});
				if(syncing){
					browser.tabs.onActivated.removeListener(syncstorage);
					browser.storage.sync.set({urls: self.urls});}}
			else if(!syncing) browser.tabs.onActivated.addListener(syncstorage);
			syncing = browser.tabs.onActivated.hasListener(syncstorage);
		});
	};
	
	//Public methods
	this.setcurrent = function(url){
		var domain = (url.match(/:\/\/(.[^/]+)/) || [])[1] || url;
		this.current = domain;
		this.trust = (domain && !this.urls.contains(domain));
		this.updateicon();
	};
	
	this.toggletrust = function(){
		if(this.trust) this.urls.push(this.current);
		else this.urls.remove(function(val){return val==self.current;});
		this.trust = !this.trust;
		this.updateicon();
		browser.storage.local.set({urls: this.urls});
		if(browser.storage.sync && !syncing) browser.storage.sync.set({urls: this.urls});
		browser.tabs.reload({bypassCache: true});
	};
	
	this.updateicon = function(){
		if(!android){
			if(this.trust) browser.browserAction.setIcon({path: "icons/icon.svg"});
			else browser.browserAction.setIcon({path: "icons/icon2.svg"});}
	};
}

/* -------------------- Main Process -------------------- */

//Browser compatibility
var browser = browser || chrome;
var android = !browser.windows;

//Global variables
var jsblocker = new JSBlocker();

//Updates icon on tab/window focus changed based on whether page is trusted
if(!android)
	browser.windows.onFocusChanged.addListener(function(winid){
		browser.tabs.query({windowId: winid, active: true},function(tabs){
			if(tabs.length) jsblocker.setcurrent(tabs[0].url);
		});
	});

browser.tabs.onActivated.addListener(function(info){
	browser.tabs.get(info.tabId,function(tab){
		jsblocker.setcurrent(tab.url);
	});
});

//Marks page untrusted or trusted when icon is clicked
browser.browserAction.onClicked.addListener(function(tab){
	jsblocker.toggletrust();
});

// block scripts on page if url is marked untrsuted based on
// whether url exists in storage
browser.webRequest.onHeadersReceived.addListener(
	function(details){
		jsblocker.setcurrent(details.url);
		if(!jsblocker.trust){
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
		else return {};
	},
	{urls: ["<all_urls>"], types: ["main_frame"]},
	["blocking", "responseHeaders"]
);
