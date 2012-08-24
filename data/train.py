### Thanks to Peter Norvig for the jumbo public domain training corpus

import re, json
from collections import defaultdict
from functools import partial

def words(text): 
	return re.findall('[a-z]+', text.lower()) 

def train_letters(features):
	unigram_model = {}
	bigram_model = {}

	for i in [chr(el) for el in range(97,123)]:
		unigram_model[i] = 0

	#use $ for start word symbol. Can only occur in first spot
	for i in ["$"] + [chr(el) for el in range(97,123)]:
		for j in [chr(el) for el in range(97,123)]:
			bigram_model[i+j] = 0
	for f in features:
		for letter in f:
			unigram_model[letter] += 1
	for f in features:
		f = "$" + f
		for i in range(len(f) - 1):
			bigram_model[f[i] + f[i+1]] +=1

	return (unigram_model, bigram_model)

def train_words(features):
	words = defaultdict(partial(defaultdict, int))
	for f in features:
		words[len(f)][f] += 1
	return words



def main(infile, uni_outfile, bi_outfile):
	pass
	# models = train_letters(words(file(infile).read()))
	# print models[0]
	# for k,v in models[1].items():
	# 	if v > 2 and k[0] == "$":
	# 		print k,v
	# print json.dumps(models[0]), uni_outfile
	# uni_out = open(uni_outfile, 'wb')
	# json.dump(models[0], uni_out)
	# bi_out = open(bi_outfile, 'wb')
	# json.dump(models[1], bi_out)

def main_words(infile, outfile):
	import operator
	model = train_words(words(file(infile).read()))
	length_list = {}
	for k,v in model.items():
		length_list[k] = [{"w": key, "c": model[k][key]} for key in sorted(model[k], key=model[k].get, reverse=True)]
	print length_list[1]

	out = open(outfile, 'wb')
	json.dump(length_list, out)

if __name__ == '__main__':
	# main('big.txt', 'uni.txt', 'bi.txt')
	main_words('big.txt', 'words.txt');
