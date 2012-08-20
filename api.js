var request = require('request');

var game_key = null;
var BASE_URL = "http://hangman.coursera.org/hangman/game";

exports.startGame = function(cb){
	if (game_key){
		console.log('game already in progress')
		return;
	}
	var opts = {
		uri: BASE_URL,
		headers: {
			"User-Agent": "hangman bot in development by jacob.lyles@gmail.com"
		},
		json: true,
		body: {email: "jacob.lyles@gmail.com"}
	};

	request.post(opts, function(err, res, data){

		if (err){
			console.error(err);
			return;
		}

		console.log('setting game_key to', data.game_key);
		game_key = data.game_key;
		
		if (cb){ 
			cb(data); 
		} else {
			console.log(data);
			return;
		}
	});
}

exports.guess = function(guess, cb){
	if (!game_key){
		console.log('you must start a game first');
		return;
	}
	var opts = {
		uri: BASE_URL + '/' + game_key,
		headers: {
			"User-Agent": "hangman bot in development by jacob.lyles@gmail.com"
		},
		json: true,
		body: {
			guess: guess
		}
	};

	request.post(opts, function(err, res, data){
		if (err){
			console.error(err);
			return;
		}

		if (data.state === 'won' || data.state === 'lost'){
			game_key = null;
		} 
		if (cb){
			cb(data); 
		}else {
			console.log(data);
			return;
		}
	});
}

exports.getGameKey = function(){
	console.log(game_key);
	return game_key;
}

if (require.main === module) {
	exports.startGame(function(data){
		exports.guess('a');
	})
}

