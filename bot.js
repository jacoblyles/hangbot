var fs = require('fs');

var _ = require('underscore');
var colors = require('colors');

var api = require('./api');

var stats;
var statsFile = __dirname + '/stats.json'
function readStats(){
	if (!fs.existsSync(statsFile)){
		return {};
	}
	var contents = fs.readFileSync(statsFile);
	return contents && JSON.parse(contents.toString());
}

function writeStats(){
	var dataFile = fs.openSync(statsFile, 'w');
	fs.writeSync(dataFile, JSON.stringify(stats));
}

stats = readStats();
var bots = ['DefaultBot', 'RandomBot', 'SmartBot'];
bots.forEach(function(bot){
	if (!stats[bot]){
		stats[bot] = {
			wins: 0,
			losses: 0
		}
	}
});


// the default bot picks a, b, c, d.... in order. All bots 
// inherit from the default bot

function Bot(){
	this.guessedLetters = [];
	this.turn = 0;
	this.num_tries_left = 5;
};
Bot.prototype = {
	name: 'DefaultBot',
	playGame: function(data){

		this.turn += 1;
		if (data.state == 'won') { 
			console.log('yay I won!'.rainbow);
			console.log('phrase was', data.phrase);
			stats[this.name].wins += 1;
			writeStats();
			this.gameOverCallback && this.gameOverCallback();
			return;
		}
		if (data.state == 'lost'){
			console.log('boo, I lost'.red);
			console.log('phrase was', data.phrase);
			stats[this.name].losses += 1;
			writeStats();
			this.gameOverCallback && this.gameOverCallback();
			return;
		}
		if (+data.num_tries_left < this.num_tries_left){
			console.log('wrong!'.red, data.num_tries_left, 'strikes left.\n'.red);
			console.log('phrase is', data.phrase);
			console.log('I\'ve guessed', this.guessedLetters);
			this.num_tries_left = +data.num_tries_left; 
		} else if(this.turn >1) {
			console.log('I\'m right!'.cyan, data.num_tries_left, 'strikes left.\n'.cyan);
			console.log('phrase is', data.phrase);
			console.log('I\'ve guessed', this.guessedLetters);
		}

		var guess = this.getBestGuess(data);
		console.log('guessing:', guess);
		this.guessedLetters.push(guess);
		api.guess(guess, this.playGame.bind(this));
	},
	startGame: function(cb){
		this.gameOverCallback = cb;
		api.startGame(function(data){
			console.log('\n');
			console.log('Hello! I am', this.name);
			console.log('My record is', stats[this.name].wins,'wins and',stats[this.name].losses + ''.red,'losses');
			console.log('That\'s ' + Math.round(100 * stats[this.name].wins / (stats[this.name].wins + stats[this.name].losses))  + '%');
			console.log('Here comes another!'.green);
			console.log('The phrase is', data.phrase);
			this.playGame(data);
		}.bind(this));
	},

	getBestGuess: function(data){
		// subclasses should probably overwrite this function
		return String.fromCharCode(96 + this.turn);
	}
}



// random bot chooses a guess at random from the letters we have not yet picked

function RandomBot(){
	this.guessedLetters = [];
	this.turn = 0;
	this.num_tries_left = 5;
};
RandomBot.prototype = new Bot();
_.extend(RandomBot.prototype, {
	name: "RandomBot",
	getBestGuess: function(){
		var guess = String.fromCharCode((97 + Math.random() * 26) | 0);
		while(this.guessedLetters.indexOf(guess) !== -1){
			guess = String.fromCharCode((97 + Math.random() * 26) | 0);
		}
		return guess;
	}
});



// smartbot uses the linear interpolation of a unigram and a bigram character model
// trained on an english corpus of about 5 million characters to predict the 
// missing character with the maximum probability
//
// prediction is argmax_l p(l|phrase) = argmax_i { argmax_l{ p(l_i|l_i-1) } for i = 0 to end of phrase}
// where p(l_i | l_i-1) = w * p(l_i) + (1 - w)p(l_i | l_i-1) for 0 < w < 1


// first, calculate some summary statistics over the bigram and unigram frequencies that will 
// be useful
var bigrams = JSON.parse(fs.readFileSync(__dirname + '/data/bi.txt'));
var	unigrams = JSON.parse(fs.readFileSync(__dirname + '/data/uni.txt'));

var ALL_LETTERS = [];
for (var i = 97; i<=122; i++){
	ALL_LETTERS.push(String.fromCharCode(i));
}
// how many letters are in the corpus. Needed to convert frequencies to probabilities
var total_letters = _.reduce(unigrams, function(memo, val){return memo + val;}, 0);

//bigrams can start with a beginning-of-word marker "$". 
//Our unigram frequencies don't include $ because we can't guess it! 
var ALL_BIGRAMS = ['$'].concat(ALL_LETTERS); 


// how many bigrams that start with letter "foo" are in the corpus. 
// needed to convert bigram frequencies into conditional probabilities 
var total_bigrams = {}
ALL_BIGRAMS.forEach(function(letter){
	total_bigrams[letter] = _.reduce(_.filter(bigrams, function(val, key){
		return key[0] === letter
	}), function(memo, val){
		return memo + val;
	}, 0);
});

function SmartBot(){
	this.guessedLetters = [];
	this.turn = 0;
	this.num_tries_left = 5;
	this.phrase = null;
	this.words = [];
};
SmartBot.prototype = new Bot();
_.extend(SmartBot.prototype,{
	name: 'SmartBot',
	lambda: 0.5,
	getBestGuess: function(data){
		this.parseGameState(data);

		// calculate maximum likelihood letter for each index in the phrase
		// among letters not yet used
		var mll = [];
		this.words.forEach(function(word){
			word.forEach(function(letter, index){
				if(letter === '_'){
					mll.push(_.max(this.getProbs(word[index-1]), function(item){
						return item.probability;
					}));
				}
			}.bind(this));
		}.bind(this));
		
		// pick global maximum likelihood letter from all remaining indices
		var pick = _.max(mll, function(item){
			return item.probability;
		});

		return pick.letter;
	},
	getProbs: function(prev){
		//given the previous letter, return probability of each letter in the current spot
		
		// remove already guessed letters from consideration
		var these_letters = ALL_LETTERS.filter(function(item){ 
			return this.guessedLetters.indexOf(item) === -1;
		}.bind(this));

		// calculate likelihood for each possible letter
		var probs = [];
		these_letters.forEach(function(letter){
			var biProb = 0;
			var uniProb = unigrams[letter] / total_letters;
			if (prev !== '_'){
				var bigram = prev + letter;
				var biProb = bigrams[bigram] / total_bigrams[prev];
			}
			probs.push({
				letter: letter,
				probability: this.lambda * uniProb + (1 - this.lambda) * biProb
			});
		}.bind(this));
		return probs;
	},
	parseGameState: function(data){
		this.words = [];
		this.phrase = data.phrase;
		this.phrase.split(' ').forEach(function(word){
			this.words.push(['$'].concat(word.split('')));
		}.bind(this));
	},
});


exports.DefaultBot = Bot;
exports.RandomBot = RandomBot;
exports.SmartBot = SmartBot;
exports.getStats = function(){
	_.each(stats, function(val,key){
		var title = 'stats for ' + key
		var wins = '' + val.wins + ' wins';
		var losses = '' + val.losses + ' losses';
		var percent = Math.round(100 * val.wins / (val.wins + val.losses));
		if (val.wins + val.losses === 0){percent = 'undefined'}
		console.log('\n');
		console.log(title.bold);
		console.log(wins.cyan);
		console.log(losses.red);
		console.log('win rate is', percent ,'percent');
	});
	return stats;
}


// if (require.main === module) {
// 	var bot = new RandomBot();
// 	bot.startGame();
// }



