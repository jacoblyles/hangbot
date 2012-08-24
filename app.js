#!/usr/bin/env node

var _ = require('underscore');
var colors = require('colors');
var argv = require('optimist').argv;


function printUsage(command){
	console.log('possible commands:');
	commands.forEach(function(item){
		console.log("\n" + item.usage.bold.cyan);
		console.log("description: ".bold.green + item.description);
	});
}

var commands = [
	{
		name: "run",
		usage: "hangbot run <name> <times>",
		description: 'runs bot named default, random, or smart <times> number of times\n \
		defaults are "default" and 1 if parameters are not supplied by the user',
		func: run
	},
	{
		name: "help",
		usage: "hangbot help",
		description: "print this help text",
		func: printUsage
	},
	{
		name: "stats",
		usage: "hangbot stats",
		description: "prints out the stats for each bot",
		func: require('./bot').getStats
	}
]

var fullNames = {
	"random": "RandomBot",
	"default": "DefaultBot",
	"smart": "SmartBot",
	"smarter": "SmarterBot"
};

function run(name, times){
	var botName = fullNames[name];
	botName = botName || 'DefaultBot'
	times = times || 1;
	var i = 0;
	var Bot = require('./bot')[botName];
	(function doRun(){
		var bot = new Bot;
		bot.startGame(function(){
			i += 1;
			if (i >= times){
				return;
			} else {
				doRun();
			}
		})
	})();
}


if (require.main === module) {
	console.log("***********".rainbow);
	console.log("HangBot".cyan);
	console.log("***********".rainbow);

	command = argv._[0] || "help";

	command = commands.filter(function(item){ return item.name === command})[0];
	if (!command){
	 	console.log("invalid command");
	 	printUsage();
	} else {
	 	command.func.apply({}, argv._.slice(1));	
	}
}


