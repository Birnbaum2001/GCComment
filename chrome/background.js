var storage = null;
var isLocalMode = false;
var promise = new Promise(function(resolve, reject) {
	chrome.storage.local.get("GccStorageMethode", function(e){
		if(typeof(e["GccStorageMethode"]) !== "undefined" && e["GccStorageMethode"] === "local"){
			storage = chrome.storage.local;
			isLocalMode = true;
		}
		else{
			storage = chrome.storage.sync;
		}
		
		if(storage !== null){
			resolve();
		}
	});		
});

var changeStorageMode = function(targetMode, data, response){	
	var oldMode;
	
	if(targetMode === "sync"){
		storage = chrome.storage.sync;
		oldMode = chrome.storage.local;
		isLocalMode = false;
	}
	else{
		storage = chrome.storage.local;
		oldMode = chrome.storage.sync;
		isLocalMode = true;
	}
	
	if(targetMode !== "sync"){
		targetMode = "local";
	}
	
	chrome.storage.local.set({GccStorageMethode: targetMode}, function(){
		oldMode.get(null , function(oldData){
			storage.set(oldData, function(){
				handleWrite(data, response);
			});	
		});
	});	
};


var handleWrite = function(data, sendResponse){	
	storage.get(null, function(oldData){
		var changedData = {};
		var removedData = [];
		var count = 0;
		for(keyName in data){
			if(data[keyName] === undefined){
				removedData.push(keyName);
			}
			else if(oldData[keyName] !== data[keyName]){
				changedData[keyName] = data[keyName];
				count++;
			}
		}
		if(count > 0){
			storage.set(changedData, function(e){			
				if (!isLocalMode 
					&& typeof(chrome.runtime.lastError) !== "undefined"
					&& typeof(chrome.runtime.lastError.message) !== "undefined"
					&& ((chrome.runtime.lastError.message.indexOf('MAX_WRITE' ) !== -1)
						|| (chrome.runtime.lastError.message.indexOf('QUOTA_BYTES' ) !== -1))){
					
					changeStorageMode("local", changedData, sendResponse);						
				}
				else{
					sendResponse(e);
				}
			});					
		}
		else{
			sendResponse();
		}
		
		if(removedData.length > 0){
			storage.remove(removedData, function(e){			
				if (count === 0){
					sendResponse(e);
				}
			});
		}
	});
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){	
		if(typeof(request["getAllValues"]) !== "undefined"){
			promise.then(function(){
				storage.get(null , sendResponse);
			});				
		}		
		else if(typeof(request["setKey"]) !== "undefined"){
			promise.then(function(){
				var data2Store = {};
				data2Store[request["setKey"]] = request["setValue"];
				handleWrite(data2Store, sendResponse);
			});
		}
		else{
			return false;
		}
	
	return true;	
});