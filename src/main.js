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
function indexWeightedMean(levels) {
	var s = sum(levels);
	if (s == 0)
		return 0;

	var ret = 0;
	for (var i = 0; i < levels.length; i++)
		ret += levels[i] * i;
	ret /= s;
	return ret;
}

function randInt(min,max) {
	return Math.floor((Math.random() * (max-min+1)) + min);
}
function randirange(a) {
	return randInt(a[0], a[1]);
}

function rnd_bmt() {
    var x = 0, y = 0, rds, c;

    // Get two random numbers from -1 to 1.
    // If the radius is zero or greater than 1, throw them out and pick two new ones
    // Rejection sampling throws away about 20% of the pairs.
    do {
    x = Math.random()*2-1;
    y = Math.random()*2-1;
    rds = x*x + y*y;
    }
    while (rds == 0 || rds > 1)

    // This magic is the Box-Muller Transform
    c = Math.sqrt(-2*Math.log(rds)/rds);

    // It always creates a pair of numbers. I'll return them in an array.
    // This function is quite efficient so don't be afraid to throw one away if you don't need both.
    //return [x*c, y*c];
    return x*c;
}

function binomialdraw(N, p) {
	if (p*N < 15) {
		var ret = 0;
		for (var i = 0; i < N; i++)
			if (Math.random() < p)
				ret++;
		return ret;
	} else {
		p=Math.min(1, Math.max(0,p));
		var gaussian = rnd_bmt();
		var variance = N * p * (1-p);
		var ret = Math.round(N*p + gaussian*variance);
		return Math.min(N, Math.max(0, ret));
	}
}

var maxworkerlevel = 16;
var maxitemlevel = 16;
var workers = null;
var items = null;
var buildings = null;
var time = 0;
var logqueue = [];

function removeOneBadWorker(workerindex) {
	for (var i=0; i < maxworkerlevel; i++) {
		if (workers[workerindex].level[i] > 0) {
			workers[workerindex].level[i]--;
			return true;
		}
	}
	return false;
}

function removeOneBadItem(itemindex) {
	for (var i=0; i < maxitemlevel; i++) {
		if (items[itemindex].level[i] > 0) {
			items[itemindex].level[i]--;
			return true;
		}
	}
	return false;
}

function trainworkers(workerindex, amount) {
	if (workerindex == 0)
		workers[0].level[0] += amount;

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
		if (removeOneBadWorker(source)) {
			workers[destination].level[0]++;
		} else {
			break;
		}
	}
	workers[workerindex].avglvl = indexWeightedMean(workers[workerindex].level);
}

function indexOf(array, name) {
	for (var i=0; i < array.length; i++)
		if (name == array[i].title)
			return i;
	return -1;
}

function check_req_list(req_list) {
	var ret = true;
	// first check if all conditions are met
	for (var i = 0; i < req_list.length; i++) {
		if (req_list[i].type == 'item') {
			var ind = indexOf(items, req_list[i].id);
			if (sum(items[ind].level) >= req_list[i].amt) {
				// ok
			} else {
				ret = false;
			}
		} else if ( req_list[i].type == 'worker') {
			var ind = indexOf(workers, req_list[i].id);
			if (sum(workers[ind].level) >= req_list[i].amt) {
				// ok
			} else {
				ret = false;
			}
		} else {
			ret=false;
			console.log("checking for requirement fails" + req_list[i]);
			alert(req_list);
		}
	}
	return ret;
}

function remove_req_list(req_list) {
	// in case we met all conditions, reduce the number of items etc
	for (var i = 0; i < req_list.length; i++) {
		if (req_list[i].type == 'item') {
			var ind = indexOf(items, req_list[i].id);
			for (var j=0; j < req_list[i].amt; j++)
				removeOneBadItem(ind);
		}
	}
}

function check_and_remove_list(req_list) {
	var ret = check_req_list(req_list);
	if (!ret)
		return false;

	remove_req_list(req_list);
	return true;
}

function new_game() {
	var box = document.getElementById("log_config");
	for (var i=0; i < box.rows; i++) {
		logqueue.push("");
	}
	workers = [
		{title: 'Unemployed', 	req:[	{type:'item', id:'Food', amt:50}],
			prod:[ //{id:'Food',  idlevel:[0, 5], amtlvl:[3,4], time: 3, req:[]},
				]},
		{title: 'Hunter', 		req:[	{type:'item', id:'Food', amt:10},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[	{id:'Food',  idlevel:[0, 5], amtlvl:[3,4], time: 3, req:[]},
					{id:'Wood',  idlevel:[0, 3], amtlvl:[0,1], time:60, req:[{type:'item', id:'Food', amt:2}]},
					{id:'Herbs', idlevel:[0, 3], amtlvl:[0,1], time:60, req:[{type:'item', id:'Food', amt:2}]},
					// todo skins, and with tools
				]},
		{title: 'Farmer', 		req:[	{type:'item', id:'Wood', amt:100},
										{type:'worker', id:'Unemployed', amt:1}],

			prod:[	{id:'Food',  idlevel:[0, 5], amtlvl:[2,4], time: 3, req:[]},
					{id:'Food',  idlevel:[5,10], amtlvl:[3,6], time:30, req:[]},
					//{id:'Herbs', idlevel:[0, 4], amtlvl:[1,2], time:, req:[]},
				]},
		{title: 'Wood cutter',  req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[	{id:'Wood',  idlevel:[0, 5], amtlvl:[1,3], time: 5, req:[]},
					{id:'Herbs', idlevel:[0, 4], amtlvl:[1,2], time:20, req:[]},
				]},
		{title: 'Stone cutter',	req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[{id:2, req:[]}]},

		{title: 'Miner', 		req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],	prod:[{id:2, req:[]}, {id:3, req:{id:0, amt:0.2}}]},
		{title: 'Smith', 		req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],	prod:[{id:4, req:[{id:3}]}]},
		{title: 'Herbsman',		req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
		{title: 'Shaman', 		req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
		{title: 'Soldier', 		req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
		{title: 'Horsemen', 	req:[	{type:'item', id:'Wood', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
	];
	for (var i = 0; i < workers.length; i++) {
		workers[i].level = makeArrayOf(0,maxworkerlevel);
		workers[i].visible = false
		workers[i].avglvl = 0;
		if (!workers[i].lvlup)
			workers[i].lvlup = 5*360 / maxworkerlevel;
	}
	workers[0].level[0] = 30;

	items = [
		{title:'Food', 		level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Wood', 		level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Stone', 	level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Ore', 		level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Iron', 		level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Herbs', 	level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Skins', 	level:makeArrayOf(0,maxitemlevel), visible:false },
		{title:'Tools', 	level:makeArrayOf(0,maxitemlevel), visible:false },
	];
	items[0].level[5]=100;

	buildings = [
			// tent
			// wooden small house
			// stone housing
			//
			// smithery
			// food storage
			// mills and butchers (improving the quality of the food)
			// tool makers hut
			// ore melting hut
			// herbary
			// skinnery

			// diese gebäude bringen 'versteckte' items, welche dann verkonsumiert werden können, müssen jedoch immer auf 0 zurückgesetzt werden
	];
}

function population_count() {
	var ret = 0;
	for (var i=0; i < workers.length; i++)
		ret += sum(workers[i].level)
	return ret;
}

function simulate_item_production() {
	// production of things
	for (var i = 0; i < workers.length; i++) {
		var prod = workers[i].prod;
		for (var p=0; p < prod.length; p++) {
			product = prod[p];
			//~ console.log(product);

			add = 0;
			for (var j=0; j < maxworkerlevel; j++) {
				if (!product.amtlvl)
					product.amtlvl = [1,1];

				amt = (product.amtlvl[0] + (product.amtlvl[1] - product.amtlvl[0]) * j/maxworkerlevel) * binomialdraw(workers[i].level[j], 1/product.time);
				add += amt;
				//~ console.log(" i:"+i+" j:"+j +" add:" +amt);
			}

			while (add > 0) {
				var ind = indexOf(items, product.id);
				items[ind].level[randirange(product.idlevel)] ++;
				add--;
			}
		}
	}
}

function simulate_time() {

	lastseason = Math.floor((time % 360) / (360/4));
	time += 1
	season = Math.floor((time % 360) / (360/4));

	if (season != lastseason) {
		s = "A new season is coming. "
		if (season == 0)
			s += "Spring has just begun.";
		else if (season == 1)
			s += "Summertime!";
		else if (season == 2)
			s += "Autumn. Leaves are falling.";
		else
			s += "Winter is frosty beast."
		logqueue.push(s);
	}

	// food upkeep
	var amt = 0.7 * population_count();
	for (var i = 0; i < amt; i++)
		removeOneBadItem(0);

	simulate_item_production();

	// worker levelups
	for (var i = 0; i < workers.length; i++) {
		for (var j=0; j < maxworkerlevel-1; j++) {
			x = binomialdraw(workers[i].level[j], 1/workers[i].lvlup)
			workers[i].level[j] -= x;
			workers[i].level[j+1] += x;

			if (indexWeightedMean(workers[i].level) > workers[i].avglvl + 1) {
				workers[i].avglvl = indexWeightedMean(workers[i].level);
				logqueue.push(workers[i].title + " have better skills now." + workers[i].avglvl + "" + workers[i].level)
			}
		}
	}
	update_gui();
}

function init(){
	new_game();
	update_gui();
	setInterval(simulate_time, 1000);
}

function update_gui() {
	update_workers();
	update_items();
	update_log();
}

function update_workers() {
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
	OoM = Math.max(0, OoM); // have at least one there
	for (var i=0; i < OoM + 1; i++)
		texts.push(Math.floor(Math.pow(10,i)));

	// fill table
	var tbl  = document.createElement('table');
	for(var i = 0; i < workers.length; i++){
		if (!workers[i].visible) {
			if (check_req_list(workers[i].req))
				workers[i].visible = true;

			if (!workers[i].visible)
				continue;
		}

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
				element.value=" " + workers[i].level; // todo remove this line
				td.appendChild(element);
			 } else {
				amt = texts[j];
				if (i != 0 || amt > 0) {
					if (amt < 0 && sum(workers[i].level) < -amt)
						continue;
					if (sum(workers[0].level) == 0 && i != 0 && amt > 0)
						continue;

					var element = document.createElement("input");
					element.type="button";
					element.value=" " + amt;
					element.workerindex=i;
					element.amt=amt;
					element.onclick=function(){trainworkers(this.workerindex, this.amt); update_workers();};
					td.appendChild(element);
				}
			}
		}
    }
    box.appendChild(tbl);
}

function update_items() {
	var box = document.getElementById("item_config");
	// clear table
	while (box.firstChild) {
		box.removeChild(box.firstChild);
	}

	texts = ['name', 'value'];
	// fill table
	var tbl  = document.createElement('table');
	for(var i = 0; i < items.length; i++){
		if (sum(items[i].level) > 0)
			items[i].visible=true;
		if (!items[i].visible)
			continue;

		var tr = tbl.insertRow();
		for(var j = 0; j < texts.length; j++){
			 var td = tr.insertCell();
			 if (texts[j] == 'name') {
				var element = document.createElement("input");
				element.type="text";
				element.readOnly = true;
				element.value= items[i].title;
				td.appendChild(element);
			 } else if  (texts[j] == 'value') {
				var element = document.createElement("input");
				element.type="text";
				element.readOnly = true;
				element.value=" " + sum(items[i].level)
				td.appendChild(element);
			 }
		}
    }
    box.appendChild(tbl);
}


function update_log() {
	var box = document.getElementById("log_config");

	box.value = "";
	for (var i=box.rows-1; i != 0; i--) {
		box.value += logqueue[i] + "\n";
	}
	logqueue.splice(0, logqueue.length-box.rows);
}
