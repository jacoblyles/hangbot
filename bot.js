var fs = require('fs');

var _ = require('underscore');
var colors = require('colors');

var api = require('./api');

//fake api for development
// var api = {
// 	turn: 0,
// 	startGame: function(cb){
// 		this.turn = 0;
// 		cb({ 
// 			game_key: 'xDH2QScZLGNSn25ksg3aVNuqAY4fZAvo',
// 			phrase: '__e _e__te ____e_ _f the ___l_',
// 			state: 'alive',
// 			num_tries_left: '5' 
// 		});
// 	}, guess: function(key, cb) { 
// 		this.turn += 1;
// 		var state = 'alive';
// 		if (this.turn > 5) {
// 			var state = Math.random() * 2 > 1 ? 'lost' : 'won';
// 		} 
// 		cb({ 
// 			game_key: 'xDH2QScZLGNSn25ksg3aVNuqAY4fZAvo',
// 			phrase: '__e _e__te ____e_ _f the ___l_',
// 			state: state,
// 			num_tries_left: '3' 
// 		});
// 	}
// }


// module-local utility objects for handling statistics for each bot
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
var bots = ['DefaultBot', 'RandomBot', 'SmartBot', 'SmarterBot'];
bots.forEach(function(bot){
	if (!stats[bot]){
		stats[bot] = {
			wins: 0,
			losses: 0
		}
	}
});



// DefaultBot: the default bot 
// Strategy: picks a, b, c, d.... in order. 
// All bots inherit from the default bot

function Bot(){
	this.guessedLetters = [];
	this.failedLetters = [];
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
			this.failedLetters.push(this.guessedLetters[this.guessedLetters.length-1]);
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



// RandomBot
// Strategy: picks an unchosen letter at random

function RandomBot(){
	this.guessedLetters = [];
	this.failedLetters = [];
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



// SmartBot
// Strategy: smartbot calculates the maximum likelihood letter from those not yet guessed 
// at each remaining index using an n-gram letter model trained on an English corpus of about 5 million characters. 
// It then chooses the global maximum likelihood letter from all indices as its guess
//
// The likelihood model it uses is a linear interpolation of a bigram and a unigram model. See the readme
// for details

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
	this.failedLetters = [];
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
					mll.push(_.max(this.getLetterProbs(word[index-1]), function(item){
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
	getLetterProbs: function(prev){
		// given the previous letter, return the conditional probability of each letter choice 
		// in the current spot
		
		// remove already guessed letters from consideration
		var these_letters = ALL_LETTERS.filter(function(item){ 
			return this.guessedLetters.indexOf(item) === -1;
		}.bind(this));

		// calculate likelihood for each possible letter choice at this index
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



/// SmarterBot
/// first finds the maximum likelihood word from a unigram word model
/// excluding words which use letters which have already failed
/// then finds the mll letter in that word from available letters

var lengthList = JSON.parse(fs.readFileSync(__dirname + '/data/words.txt'));
var totalWords = _.reduce(lengthList, function(total, list){
	return total + list.reduce(function(memo, item){
		return memo + item.c;
	},0);
}, 0);

function SmarterBot(){
	this.guessedLetters = [];
	this.failedLetters = [];
	this.turn = 0;
	this.num_tries_left = 5;
	this.phrase = null;
	this.words = [];
};

// inherit from smartbot
SmarterBot.prototype = new SmartBot();
SmarterBot.parent = _.clone(SmarterBot.prototype);
_.extend(SmarterBot.prototype,{
	name: 'SmarterBot',
	lambda: 0.5,
	getBestGuess: function(data){
		this.parseGameState(data);

		var mlw = [];

		this.words.forEach(function(word){
			// for words not yet completely guessed, find the word with the highest 
			// probability of occurence with the letters we still have
			if (word.indexOf("_") === -1){
				return;
			}
			var len = word.length - 1; // subtract off start token
			mlw.push(this.getBestWord(word));

		}.bind(this));

		console.log('mlw', mlw);
		// get rid of null guesses
		mlw = mlw.filter(function(item){
			return item.word;
		});
		console.log('mlw', mlw);

		// no word guesses? default to letters
		if(!mlw.length){
			console.log('using letters');
			// todo, figure out how to make super work
			var mll = [];
			this.words.forEach(function(word){
				console.log(word);
				word.forEach(function(letter, index){
					if(letter === '_'){
						mll.push(_.max(this.getLetterProbs(word[index-1]), function(item){
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
		}

		var maxWord = _.max(mlw, function(item){ return item.prob });
		console.log('I think I see', maxWord.word);
		
		var mll = [];
		maxWord = ['$'].concat(maxWord.word.split(''));

		maxWord.forEach(function(letter, index){
			if (letter !== '$'){
				mll.push({
					letter: letter,
					probability: this.getBigramProb(maxWord[index - 1], letter)
				});
			}
		}.bind(this));

		// console.log('mll, unfiltered', mll);
		// console.log(this.guessedLetters);

		mll = mll.filter(function(item){
			return this.guessedLetters.indexOf(item.letter) === -1;
		}.bind(this));

		// console.log('mll, filtered', mll);

		var pick = _.max(mll, function(item){
			return item.probability;
		});
		return pick.letter;
	},

	getBigramProb: function(prev, curr){
		var biProb = 0;
		var uniProb = unigrams[curr] / total_letters;
		var bigram = prev + curr;
		var biProb = bigrams[bigram] / total_bigrams[prev];
		return this.lambda * uniProb + (1 - this.lambda) * biProb;
	},

	getBestWord: function(toGuess){
		var len = toGuess.length - 1;
		toGuess = _.clone(toGuess).splice(1);

		// gets the most likely word for the available letters
		var list = lengthList[len];
		var reject, wordPick, wordProb;
		for (var i = 0; item = list[i]; i++){
			var word = item.w.split('');
			reject = false;

			// reject if it uses letters that were wrong
			this.failedLetters.forEach(function(letter){
				if (word.indexOf(letter) !== -1){
					reject = true;
					return;
				}
			});

			// reject if its correct letters don't align with current word
			if (!reject){
				word.forEach(function(letter, index){
					if (this.guessedLetters.indexOf(letter) !== -1 && toGuess[index] !== word[index]){
						reject = true;
					}
					if (toGuess[index] !== '_' && toGuess[index] !== word[index]){
						reject = true;
					}
				}.bind(this));
			}

			if (!reject){
				wordPick = item;
				break;
			}
		}
		if (!wordPick){
			return {
				word: null,
				prob: 0
			}	
		}
		wordProb = wordPick.c / totalWords;
		return {
			word: wordPick && wordPick.w,
			prob: wordProb || 0
		}
	}
});


exports.DefaultBot = Bot;
exports.RandomBot = RandomBot;
exports.SmartBot = SmartBot;
exports.SmarterBot = SmarterBot;
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

if (require.main === module){
	var bot = new SmarterBot();
	bot.startGame();
}




