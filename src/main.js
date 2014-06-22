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

var DEBUG = false;

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
function sumStartingAt(array, startat) {
	var ret = 0;
	for (var i = startat; i < array.length; i++)
		ret += array[i];
	return ret;
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

function highestIndexNonZero(array) {
	var ret = 0;
	for (var i = array.length-1; i > -1; i--)
		if (array[i] != 0)
			return i;
	return -1;
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
var maxbuildinglevel = 16;
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

function removeRandom(array) {
	s = sum(array);
	r = Math.random();
	for (var i = 0; i < array.length; i++) {
		if (r > sumStartingAt(array, i+1)) {
			array[i]--;
			break;
		}
	}
}

function trainworkers(workerindex, amount) {

	var amt=amount;
	while (amt>0) {
		if (check_and_remove_list(workers[workerindex].req)) {
			workers[workerindex].level[0]++;
			amt--;
		} else {
			break;
		}
	}

	while (amt < 0) {
		if (removeOneBadWorker(workerindex)) {
			workers[0].level[0]++;
			amt++;
		} else {
			break;
		}
	}

	workers[workerindex].avglvl = indexWeightedMean(workers[workerindex].level);
}

function createBuilding(buildingindex, amt) {
	while (amt > 0) {
		if (check_and_remove_list(buildings[buildingindex].req))
			buildings[buildingindex].level[0]++;
		amt--;
	}
}

function indexOf(array, name) {
	for (var i=0; i < array.length; i++)
		if (name == array[i].title)
			return i;
	return -1;
}

function check_req_list(req_list, amt) {
	if (!amt)
		amt=1;
	var ret = true;
	// first check if all conditions are met
	for (var i = 0; i < req_list.length; i++) {
		if (req_list[i].type == 'item') {
			var ind = indexOf(items, req_list[i].id);
			if (ind == -1)
				alert('unknown item' + req_list[i].id);
			if (sum(items[ind].level) >= req_list[i].amt * amt) {
				// ok
			} else {
				ret = false;
			}
		} else if (req_list[i].type == 'worker') {
			var ind = indexOf(workers, req_list[i].id);
			if (sum(workers[ind].level) >= req_list[i].amt * amt) {
				// ok
			} else {
				ret = false;
			}
		} else if (req_list[i].type == 'season') {
			s = req_list[i].id.toLowerCase();
			if ((s == 'spring' && season == 0) ||
				(s == 'summer' && season == 1) ||
				(s == 'autumn' && season == 2) ||
				(s == 'winter' && season == 3) ) {
				// ok
			} else {
				ret = false;
			}
		} else if (req_list[i].type == 'building') {
			var ind = indexOf(buildings, req_list[i].id);
			if (sum(buildings[ind].level) >= req_list[i].amt * amt) {
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
		} else if ( req_list[i].type == 'worker') {
			var ind = indexOf(workers, req_list[i].id);
			for (var j=0; j < req_list[i].amt; j++)
				removeOneBadWorker(ind);
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


		{title: 'Hunter', 		req:[	{type:'item', id:'Food', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[	{id:'Food',  idlevel:[0, 1], amtlvl:[2,2], time:  3, req:[]},
					{id:'Food',  idlevel:[0, 2], amtlvl:[1,2], time:  7, req:[]},
					{id:'Food',  idlevel:[0, 3], amtlvl:[1,2], time:  9, req:[]},
					{id:'Herbs', idlevel:[0, 3], amtlvl:[0,1], time:360, req:[{type:'item', id:'Food', amt:2}]},
					// todo skins, and with tools
				]},

		{title: 'Farmer', 		req:[	{type:'item', id:'Wood', amt:100},
										{type:'worker', id:'Unemployed', amt:1},
										{type:'building', id:'Farm', amt:1}],

			prod:[
					//~ {id:'Food',  idlevel:[0, 5], amtlvl:[2,4], time: 3, req:[]},
					//~ {id:'Food',  idlevel:[5,10], amtlvl:[3,6], time:30, req:[]},

					{id:'planted_crops_spring',  idlevel:[5,12], amtlvl:[6,9], time:2, req:[{type:'season', id:'spring'}]},
					{id:'planted_crops_autumn',  idlevel:[5,12], amtlvl:[6,9], time:2, req:[{type:'season', id:'autumn'}]},

					{id:'Food',  idlevel:[5,10], amtlvl:[9,9], time:1, req:[{type:'item', id:'planted_crops_spring', amt:9},{type:'season', id:'autumn'}]},
					{id:'Food',  idlevel:[5,10], amtlvl:[9,9], time:1, req:[{type:'item', id:'planted_crops_autumn', amt:9},{type:'season', id:'spring'}]},
					{id:'Food',  idlevel:[5,10], amtlvl:[1,1], time:1, req:[{type:'item', id:'planted_crops_spring', amt:1},{type:'season', id:'autumn'}]},
					{id:'Food',  idlevel:[5,10], amtlvl:[1,1], time:1, req:[{type:'item', id:'planted_crops_autumn', amt:1},{type:'season', id:'spring'}]},

					//{id:'Herbs', idlevel:[0, 4], amtlvl:[1,2], time:, req:[]},
				]}, // todo make dependant on season!


		{title: 'Wood cutter',  req:[	{type:'item', id:'Food', amt:10},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[	{id:'Wood',  idlevel:[0, 5], amtlvl:[1,3], time: 5, req:[]},
					{id:'Herbs', idlevel:[0, 4], amtlvl:[1,2], time:20, req:[]},
				]},// todo make dependant on season!


		{title: 'Stone cutter',	req:[	{type:'item', id:'Food', amt:10},
										{type:'item', id:'Wood', amt:10},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[	{id:'Stone',  idlevel:[0, 5], amtlvl:[1,3], time:  5, req:[]},
					{id:'Ore', 	  idlevel:[0, 3], amtlvl:[1,2], time:720, req:[]},
				]},

		{title: 'Miner', 		req:[	{type:'item', id:'Wood',  amt:1},
										{type:'item', id:'Tools', amt:1},
										{type:'worker', id:'Unemployed', amt:1}
									],

			prod:[	{id:'Stone',  idlevel:[0, 5], amtlvl:[1,3], time:50, req:[]},
					{id:'Ore', 	  idlevel:[0, 7], amtlvl:[1,2], time:10, req:[]},
					{id:'Ore', 	  idlevel:[7,12], amtlvl:[5,7], time:25, req:[{type:'item', id:'Tools', amt:1}]},
				]},


		{title: 'Smith', 		req:[	{type:'item', id:'Wood', amt:1},
										{type:'item', id:'Ore',  amt:1},
										{type:'worker', id:'Unemployed', amt:1}],

			prod:[	{id:'Iron',  idlevel:[0, 5], amtlvl:[1,3], time:10, req:[{type:'item', id:'Ore', amt:3}]},
					{id:'Tools', idlevel:[0, 7], amtlvl:[1,2], time:50, req:[{type:'item', id:'Iron', amt:2}, {type:'item', id:'Wood', amt:2} ]},
				]},


		{title: 'Herbsman',		req:[	{type:'item', id:'Herbs', amt:1},
										{type:'worker', id:'Unemployed', amt:1}],
			prod:[	{id:'Herbs',  idlevel:[0, 5], amtlvl:[1,3], time:10, req:[]},
					//~ {id:'Tools', idlevel:[0, 7], amtlvl:[1,2], time:50, req:[]},
				]},

		//~ {title: 'Shaman', 		req:[	{type:'item', id:'Wood', amt:1},
										//~ {type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
		//~ {title: 'Soldier', 		req:[	{type:'item', id:'Wood', amt:1},
										//~ {type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
		//~ {title: 'Horsemen', 	req:[	{type:'item', id:'Wood', amt:1},
										//~ {type:'worker', id:'Unemployed', amt:1}],	prod:[{id:0, req:[]}]},
	];
	for (var i = 0; i < workers.length; i++) {
		workers[i].level = makeArrayOf(0,maxworkerlevel);
		workers[i].visible = false
		workers[i].avglvl = 0;
		workers[i].maxlvl = 1;
		if (!workers[i].lvlupSelfTaught)
			workers[i].lvlupSelfTaught = 50*360 / maxworkerlevel;
		if (!workers[i].lvlupLearning)
			workers[i].lvlupLearning = 5*360 / maxworkerlevel;
	}
	workers[0].level[0] = 3;

	items = [
		{title:'Food', decaying:30 }, // decaying very fast
		{title:'Wood', 		},
		{title:'Stone', 	},
		{title:'Ore', 		},
		{title:'Iron', 		},
		{title:'Herbs', 	},
		{title:'Skins', 	},
		{title:'Tools', 	},
		{title:'Charcoal', 	},

		{title:'planted_crops_spring', hidden:true},
		{title:'planted_crops_autumn', hidden:true},
	];
	for (var i=0; i < items.length; i++) {
		items[i].level = makeArrayOf(0,maxitemlevel);
		items[i].visible = false;
		if (!items[i].decaying)
			items[i].decaying = 0; // standard items don't decay
		if (!items[i].hidden)
			items[i].hidden=false;

	}
	items[0].level[5]=99;

	buildings = [
		{title:'Tent', req:[{type:'item', id:'Skins', amt:1}]},
		{title:'Hut' ,req:[{type:'item', id:'Wood', amt:100}]},
		{title:'House',req:[{type:'item', id:'Wood', amt:100}]},

		{title:'Farm',req:[{type:'item', id:'Wood', amt:100}]},
		{title:'Mill',req:[{type:'item', id:'Wood', amt:100}]},
		{title:'Butchery',req:[{type:'item', id:'Wood', amt:100}]},

		{title:'Tool Makers Hut',req:[{type:'item', id:'Wood', amt:100}]},
		{title:'Smithery',req:[{type:'item', id:'Wood', amt:100}]},
		{title:'Ore Melting Hut',req:[{type:'item', id:'Wood', amt:100}]},
		{title:'Charcoal burner',req:[{type:'item', id:'Wood', amt:100}]},

		{title:'Herb Garden',req:[{type:'item', id:'Wood', amt:100}]},
		{title:'Skinner Hut',req:[{type:'item', id:'Wood', amt:100}]},


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

			//charcoal burner ?

			// diese gebäude bringen 'versteckte' items, welche dann verkonsumiert werden können, müssen jedoch immer auf 0 zurückgesetzt werden
	];

	for (var i=0; i < buildings.length; i++) {
		buildings[i].level = makeArrayOf(0,maxbuildinglevel);
		buildings[i].visible = false;
		if (!buildings[i].hidden)
			buildings[i].hidden=false;
	}
}

function population_count() {
	var ret = 0;
	for (var i=0; i < workers.length; i++)
		ret += sum(workers[i].level)
	return ret;
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
			s += "Winter is a frosty beast."
		logqueue.push(s);
	}
}

function starveRandomWorker(amt) {
	if (amt <= 0)
		return;

	for (var j=0; j < amt; j++) {
		r = Math.random();
		s = population_count()
		si = s;
		for (var i=0; i < workers.length; i++) {
			si -= sum(workers[i].level);
			if (r > si/s) {
				removeRandom(workers[i].level);
				break;
			}
		}
	}
	logqueue.push(" "+amt + " people starved.");
}

function upkeep() {
	// food upkeep
	var amt = 0.7 * population_count();
	var neededfood = 0;
	while (amt --> 1)
		if (!removeOneBadItem(indexOf(items, 'Food')))
			neededfood++;
	if (Math.random() < amt)
		if (!removeOneBadItem(indexOf(items, 'Food')))
			neededfood++;

	starveRandomWorker(Math.round(neededfood*Math.random()));

	// Items can decay (i.e. hunted food decays fast, if not prepared)
	for (var i = 0; i < items.length; i++) {
		if (items[i].decaying) {
			for (var j = 1; j < maxitemlevel; j++) {
				amt = binomialdraw(items[i].level[j], 1/items[i].decaying)
				items[i].level[j-1] += amt;
				items[i].level[j] -= amt;
			}
			amt = binomialdraw(items[i].level[0], 1/items[i].decaying)
			items[i].level[0] -= amt;
			if (amt != 0)
				logqueue.push(""+amt+ " " + items[i].title + " decayed.");

		}
	}

	//~ if ()
}

function simulate_item_production() {
	// production of things
	for (var i = 0; i < workers.length; i++) {
		var prod = workers[i].prod;
		for (var p=0; p < prod.length; p++) {
			product = prod[p];


			var add = 0;
			for (var j=0; j < maxworkerlevel; j++) {
				if (!product.amtlvl)
					product.amtlvl = [1,1];

				var nr_produced_per_round = binomialdraw(workers[i].level[j], 1/product.time);
				for (var k=0; k < nr_produced_per_round; k++) {
					if (check_and_remove_list(product.req))
						add += (product.amtlvl[0] + (product.amtlvl[1] - product.amtlvl[0]) * j/maxworkerlevel);
				}
			}
			//~ console.log(" "+product + "" + add);

			while (add > 0) {
				var ind = indexOf(items, product.id);
				items[ind].level[randirange(product.idlevel)] ++;
				add--;
			}
		}
	}
}

function worker_levelups() {
	// worker levelups
	for (var i = 0; i < workers.length; i++) {
		for (var j=0; j < maxworkerlevel-1; j++) {
			if (workers[i].lvlupSelfTaught != 0) {
				x = binomialdraw(workers[i].level[j], 1/workers[i].lvlupSelfTaught)
				workers[i].level[j] -= x;
				workers[i].level[j+1] += x;
			}

			if (sumStartingAt(workers[i].level, j+1) != 0) {
				x = binomialdraw(workers[i].level[j], 1/workers[i].lvlupLearning)
				workers[i].level[j] -= x;
				workers[i].level[j+1] += x;
			}

			if (indexWeightedMean(workers[i].level) > workers[i].avglvl + 0.99) {
				workers[i].avglvl = indexWeightedMean(workers[i].level);
				s = workers[i].title + " have better skills now."
				if (DEBUG)
					s+= "  " + workers[i].maxlvl + "  " + workers[i].avglvl + "  " + workers[i].level
				logqueue.push(s)
			}

			if (workers[i].maxlvl < highestIndexNonZero(workers[i].level)) {
				workers[i].maxlvl = highestIndexNonZero(workers[i].level);
				s = "The best " + workers[i].title + " learned a new trick.";
				if (DEBUG)
					s+= "  " + workers[i].maxlvl + "  " + workers[i].avglvl + "  " + workers[i].level
				logqueue.push(s)
			}
		}
	}
}

function gametick() {
	simulate_time();
	simulate_item_production();
	upkeep();
	worker_levelups();
	update_gui();
}

function init(){
	new_game();
	update_gui();
	setInterval(gametick, 1000);
}

function update_gui() {
	update_workers();
	update_items();
	update_buildings();
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
				if (DEBUG)
					element.value += "   " + workers[i].level; // todo remove this line
				td.appendChild(element);
			 } else {
				amt = texts[j];
				if (amt > 0) {
					if (check_req_list(workers[i].req, amt)) {
						var element = document.createElement("input");
						element.type="button";
						element.value=" " + amt;
						element.workerindex=i;
						element.amt=amt;
						element.onclick=function(){trainworkers(this.workerindex, this.amt); update_workers();};
						td.appendChild(element);
					}
				}
				if (amt < 0 && i != 0) {
					if (sum(workers[i].level) >= -amt) {
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
		if (!items[i].visible || (items[i].hidden && !DEBUG))
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
				element.type = "text";
				element.readOnly = true;
				element.value = " " + sum(items[i].level)
				if (DEBUG)
					element.value += "    " + items[i].level
				td.appendChild(element);
			 }
		}
    }
    box.appendChild(tbl);
}

function update_buildings() {
	var box = document.getElementById("building_config");
	// clear table
	while (box.firstChild) {
		box.removeChild(box.firstChild);
	}

	texts = ['name', 'value', 1];
	// fill table
	var tbl  = document.createElement('table');
	for(var i = 0; i < buildings.length; i++){
		if (check_req_list(buildings[i].req))
			buildings[i].visible = true;

		if (!buildings[i].visible || (buildings[i].hidden && !DEBUG))
			continue;

		var tr = tbl.insertRow();
		for(var j = 0; j < texts.length; j++){
			 var td = tr.insertCell();
			 if (texts[j] == 'name') {
				var element = document.createElement("input");
				element.type="text";
				element.readOnly = true;
				element.value= buildings[i].title;
				td.appendChild(element);
			 } else if  (texts[j] == 'value') {
				var element = document.createElement("input");
				element.type="text";
				element.readOnly = true;
				element.value=" " + sum(buildings[i].level)
				td.appendChild(element);
			 } else {
				if (check_req_list(buildings[i].req)) {
					var element = document.createElement("input");
					element.type="button";
					element.value="Build a " + buildings[i].title;
					element.buildingindex=i;

					element.onclick=function(){createBuilding(this.buildingindex, 1); update_gui();};
					td.appendChild(element);
				}
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
