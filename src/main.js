/*
Copyright (c) <2014>, <Stefan Beller>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer
      in the documentation and/or other materials provided with the distribution.

* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
* AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
* IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
* ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
* LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
* CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
* SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
* INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
* CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
* ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
* THE POSSIBILITY OF SUCH DAMAGE.
*/

var save = null;

// todo: count as function summing over levels
// maxlevel 15, toin coss chance for upgrade, increases if there are higher ups already.
// firing is a random process with weight on the low levels
// level0yield

function makeArrayOf(value, length) {
  var arr = [], i = length;
  while (i--) {
    arr[i] = value;
  }
  return arr;
}

function sum(array){
	return array.reduce(function(a, b) { return a + b });
}
var maxlevel = 16;
var workers = [
	{ title: 'Unemployed', 		level:[10,0,0,0,0,0,0,0,0,0,0,0,0,0,0] },
	{ title: 'Hunter', 			level:makeArrayOf(0,maxlevel)},
	{ title: 'Farmer', 			level:makeArrayOf(0,maxlevel)},
	{ title: 'Wood cutter', 	level:makeArrayOf(0,maxlevel)},
	{ title: 'Stone cutter', 	level:makeArrayOf(0,maxlevel)},
	{ title: 'Miner', 			level:makeArrayOf(0,maxlevel)},
	{ title: 'Smith', 			level:makeArrayOf(0,maxlevel)},
	{ title: 'Herbsman',		level:makeArrayOf(0,maxlevel)},
	{ title: 'Shaman', 			level:makeArrayOf(0,maxlevel)},
	{ title: 'Soldier', 		level:makeArrayOf(0,maxlevel)},
	{ title: 'Horsemen', 		level:makeArrayOf(0,maxlevel)},
];

var items = []

var buildings = [];

function removeOneWorker(workerindex) {
	for (var i=0; i < maxlevel; i++) {
		if (workers[workerindex].level[i] > 0) {
			workers[workerindex].level[i]--;
			return true;
		}
	}
	return false;
}

function trainworkers(workerindex, amount) {
	if (amount > 0) {
		destination = workerindex;
		source = 0;
		amt= amount;
	} else {
		destination = 0;
		source = workerindex;
		amt = -amount;
	}
	for (var i = 0; i < amt; i++) {
		if (removeOneWorker(source)) {
			workers[destination].level[0]++;
		} else {

			break;
		}
	}
}

function init(){
	update_gui();
}

function update_gui() {
	var box = document.getElementById("worker_config");
	// clear table
	while (box.firstChild) {
		box.removeChild(box.firstChild);
	}

	// find maximum for training
	var maxworkers = 0;
	for(var i = 1; i < workers.length; i++) {
		maxworkers = Math.max(sum(workers[i].level),maxworkers);
	}
	var texts = ['name'];
	var OoM = Math.floor(Math.log(maxworkers) / Math.log(10));
	for (var i=0; i < OoM + 1; i++)
		texts.push(Math.floor(-Math.pow(10,i)));
	texts.push(['value']);
	var OoM = Math.floor(Math.log(sum(workers[0].level)) / Math.log(10));
	for (var i=0; i < OoM + 1; i++)
		texts.push(Math.floor(Math.pow(10,i)));

	// fill table
	var tbl  = document.createElement('table');
	for(var i = 0; i < workers.length; i++){
		var tr = tbl.insertRow();

		for(var j = 0; j < texts.length; j++){
			 var td = tr.insertCell();
			 if (texts[j] == 'name') {
				var element = document.createElement("input");
				element.type="text";
				element.readOnly = true;
				element.value= workers[i].title;
				td.appendChild(element);
			 } else if  (texts[j] == 'value') {
				var element = document.createElement("input");
				element.type="text";
				element.readOnly = true;
				element.value=" " + sum(workers[i].level)
				td.appendChild(element);
			 } else {
				if (i != 0) {
					amt = texts[j];
					if (amt < 0 && sum(workers[i].level) < -amt)
						continue;

					var element = document.createElement("input");
					element.type="button";
					element.value=" " + amt;
					element.workerindex=i;
					element.amt=amt;
					element.onclick=function(){trainworkers(this.workerindex, this.amt); update_gui();};
					td.appendChild(element);
				}
			}

		}
    }
    box.appendChild(tbl);
}

