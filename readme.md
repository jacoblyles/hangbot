Hangbot
========

Hangbot is an automated hangman player bot program for playing hangman over the web. It comes with three bots:
*DefaultBot guesses letters in alphabetical order. It's not too bright!
*RandomBot guesses letters at random
*SmartBot uses an n-gram letter model 

I tested RandomBot and SmartBot for 100 games. RandomBot had 0 wins and 100 losses, while SmartBot got 33 wins to 67 losses. Let's tackle the usage instructions first and then I'll describe SmartBot's algorithm a bit more.

#Installation and Usage

To use Hangbot, first make sure you are using a machine with a recent copy of node.js and [npm](http://npmjs.org/). Then you can install this project with 

   $ git clone 
   $ cd hangbot
   $ npm install -g

The "-g" flag installs an executable script that will be accessible from any working directory. Pretty nifty!

The commands available for hangbot are:

    hangbot help
prints out the usage instructions

    hangbot stats
prints the win/loss stats of the bots available on your machine

    hangbot run <botname> <times>
tell the bot to play hangman for you! Options for <botname> are 'default', 'random', and 'smart'. <times> should be an integer. Both parameters are optional, the defaults are 'default' and 1


#SmartBot algorithm

SmartBot uses a linear interpolation of a unigram and a bigram letter model trained on a ~5 million character [corpus](http://norvig.com/big.txt) (thanks for the corpus, Peter Norvig!). For each unfilled position, SmartBot uses the letter model to choose a maximum likelihood potential letter. SmartBot takes the global maximum likelihood letter over all positions as its guess. 

The probability of letter `l` at position `i` is given by

    p(l_i) = w * unigram(l_i) + (1 - w) * bigram(l_i)

Where `w` is between 0 and 1. Since `unigram` and `bigram` return probabilities, then `p(l_i)` will also be between 0 and 1, which is what we want!

The sub-models are given by:

    unigram(l_i) = count(l) / total_letters
    bigram(l_i) = p(l_i | l_i-1) = count(l_i-1, l_i) / count(l_i-1)

As I mentioned, SmartBot is significantly better than RandomBot! 


contributors:

[jacoblyles](http://www.jacoblyles.com)

