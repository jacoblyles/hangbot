### Thanks to Peter Norvig for the jumbo public domain training corpus

import re, collections, json

def words(text): 
	return re.findall('[a-z]+', text.lower()) 

def train(features):
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


def main(infile, uni_outfile, bi_outfile):
	models = train(words(file(infile).read()))
	# print models[0]
	# for k,v in models[1].items():
	# 	if v > 2 and k[0] == "$":
	# 		print k,v
	print json.dumps(models[0]), uni_outfile
	uni_out = open(uni_outfile, 'wb')
	json.dump(models[0], uni_out)
	bi_out = open(bi_outfile, 'wb')
	json.dump(models[1], bi_out)

if __name__ == '__main__':
	main('big.txt', 'uni.txt', 'bi.txt')
