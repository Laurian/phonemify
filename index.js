const phonemes = require('./cmudict.js').phonemes();
exports.textToPhonemes = function convert(rawInputToPhonemize) {
	var inputLines = rawInputToPhonemize.split("\n");
	var inputWords = [];
	//split input into 2D array based on newlines
	for (i = 0; i < inputLines.length; i++) {
		inputWords[i] = inputLines[i].replace(/[—-]/g, " "); //hypens frequently denote compound words. cmudict likely has the two base words, but not the compound
		inputWords[i] = inputWords[i].split(" ");
	}
	//remove elements that are simply empty strings
	for (i = 0; i < inputWords.length; i++) {
		var index = inputWords[i].indexOf("");
		while (index !== -1) {
			inputWords[i].splice(index, 1);
			index = inputWords[i].indexOf("");
		}
	}

	var phonemesToOutput = "";
	for (i = 0; i < inputWords.length; i++) {
		for (j = 0; j < inputWords[i].length; j++) {
			var thisWord = inputWords[i][j].toUpperCase(); //words in array are all caps, need to make our query match
			thisWord = removeDiacritics(thisWord); //change accented characters to their non-accented variants to avoid issues with words like résumé
			thisWord = thisWord.replace(/[‘’]/g, "'"); //change smart single quote to dumb variant
			thisWord = thisWord.replace(/[^a-z0-9']/gi, ""); //nuke all characters other than alphanumeric and apostrophe
			if (thisWord.length == 0) { //in case some empty array sneaked by. https://www.merriam-webster.com/words-at-play/snuck-or-sneaked-which-is-correct
				continue;
			}
			var thisPhoneme = "";
			if (j == inputWords[i].length - 1) { //if last word in line
				var wordSeperator = "\n";
			} else {
				var wordSeperator = "  ";
			}
			var thisPhoneme = findPhonemes(thisWord);
			if(thisPhoneme) {
				phonemesToOutput = phonemesToOutput + thisPhoneme + wordSeperator;
			} else {
				if(isFinite(thisWord)) { //if numeric, convert to words
					var numberWords = convertNumberToWords(thisWord).toUpperCase();
					var theseWords = numberWords.split(" ");
					if(theseWords.length > 0) {
						for(k=0; k < theseWords.length; k++) {
							if(k < theseWords.length - 1) {
								wordSeperator = "  ";
							} else {
								wordSeperator = "\n";
							}
							thisWord = theseWords[k];
							var thisPhoneme = findPhonemes(thisWord);
							if(thisPhoneme) {
								phonemesToOutput = phonemesToOutput + thisPhoneme + wordSeperator;
							}
						}
					}
				} else {
					var thisPhoneme = checkIfAAVEGerund(thisWord); //see if its a gerund ending in ' instead of g
					if(thisPhoneme) {
						phonemesToOutput = phonemesToOutput + thisPhoneme + wordSeperator;
					} else {
						var thisPhoneme = translateViaNRL(thisWord); //translate using NRL algorithm
						if(thisPhoneme) {
							phonemesToOutput = phonemesToOutput + thisPhoneme + wordSeperator;
						} else {
							return "error: couldn't find word '" + thisWord + "' and failed to translate it via NRL.";
						}
					}
				}
			}
		}
	}
	return phonemesToOutput;
}
	


function findPhonemes(word) {
	var translation = phonemes.find(function (obj) {
		return obj.text === word;
	});
	if (translation !== undefined) { //if match found in dictionary
		thisPhoneme = translation.phonemes;
		return thisPhoneme;
	} else {
		return false;
	}
}

function checkIfAAVEGerund(word) {
	var AAVEregex = /\w*in'/gi;
	var match = word.match(AAVEregex);
	if(match !== null) {
		word = word.substring(0, word.length - 1);
		word = word + "G";
		var thisPhoneme = findPhonemes(word);
		if(thisPhoneme) {
			thisPhoneme = thisPhoneme.substring(0, thisPhoneme.length - 2);
			return thisPhoneme;
		} else {
			return false;
		}
	} else {
		return false;
	}
}

//=================================================================
//===== Navy Research Lab Implementation ==========================
//=================================================================
/*
	Based on: NRL Report 7948, "Automatic Translation of English Text to Phonetics by Means of Letter-to-Sound Rules""
	Report Authors: HONEY SUE EL.OVITZ, RODNEY W. JOHNSON, ASTRID McHUGH, AND JOHN E. SHORE
	Dated: 1976-01-21
	Located At: http://www.dtic.mil/dtic/tr/fulltext/u2/a021929.pdf
*/

// # = 1 or more vowels = /[AEIOUY]+/i
// * = 1 or more consonants = /[bcdfghjklmnpqrstvwxz]+/i
// . = a voiced consonant = /[BDVGJLMNRWZ]/i
// $ = single consonant followed by an 'i' or 'e' = /[BCDFGHJKLMNPQRSTVWXZ][ei]/i
// % = suffix such as 'e', 'es', 'ed', 'er', 'ing', 'ely' = /(?:er)|(?:es)|(?:ed)|(?:ing)|e/i
// & = a silibant = /(?:ch)|(?:sh)|[scgzxj]/i
// @ = a consonant after which long 'u' is pronounced as in 'rule', not 'mule' = /(?:ch)|(?:sh)|(?:th)|[tsrdlznj]/i
// ^ = a single consonant = /[BCDFGHJKLMNPQRSTVWXZ]/i
// + = a front vowel = /[EIY]/i
// : = 0 or more consonants = /[bcdfghjklmnpqrstvwxz]*/i
 
// vowel = ['a', 'e', 'i', 'o', 'u', 'y'];
// consonant = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z'];
// voiced = ['b', 'd', 'v', 'g', 'j', 'l', 'm', 'n', 'r', 'w', 'z'];
// front = ['e', 'i', 'y'];
// suffix = ['er', 'e', 'es', 'ed', 'ing'];
// silibant = ['s', 'c', 'g', 'z', 'x', 'j', 'ch', 'sh'];
// nonpal = ['t', 's', 'r', 'd', 'l', 'z', 'n', 'j', 'th', 'ch', 'sh'];

function translateNRLRule (word, rule) { 
	var test = word.original.substring(0, word.pointer) + word.original.charAt(word.pointer).toLowerCase() + word.original.substring(word.pointer + 1);
	var matches = test.substring(word.pointer - rule.extra).match(rule.regex); 
	if(matches) {
		word.translated = word.translated + rule.phonemes + " ";
		word.pointer = word.pointer + rule.letters.length;
		word.leftToTranslate = word.leftToTranslate.substring(rule.letters.length);
		return word;
	} else {
		return false;
	}
}


exports.translateViaNRL = function translateViaNRL (wordToTranslate) {
	var word = {
		pointer:0,
		translated:"",
		original:wordToTranslate,
		leftToTranslate:wordToTranslate
	};
	while(word.leftToTranslate !== "") {
		switch(word.leftToTranslate.charAt(0)) {
			case 'A':
				word = aRuleEng(word);
				break;
			case 'B':
				word = bRuleEng(word);
				break;
			case 'C':
				word = cRuleEng(word);
				break;
			case 'D':
				word = dRuleEng(word);
				break;
			case 'E':
				word = eRuleEng(word);
				break;
			case 'F':
				word = fRuleEng(word);
				break;
			case 'G':
				word = gRuleEng(word);
				break;
			case 'H':
				word = hRuleEng(word);
				break;
			case 'I':
				word = iRuleEng(word);
				break;
			case 'J':
				word = jRuleEng(word);
				break;
			case 'K':
				word = kRuleEng(word);
				break;
			case 'L':
				word = lRuleEng(word);
				break;
			case 'M':
				word = mRuleEng(word);
				break;
			case 'N':
				word = nRuleEng(word);
				break;
			case 'O':
				word = oRuleEng(word);
				break;
			case 'P':
				word = pRuleEng(word);
				break;
			case 'Q':
				word = qRuleEng(word);
				break;
			case 'R':
				word = rRuleEng(word);
				break;
			case 'S':
				word = sRuleEng(word);
				break;
			case 'T':
				word = tRuleEng(word);
				break;
			case 'U':
				word = uRuleEng(word);
				break;
			case 'V':
				word = vRuleEng(word);
				break;
			case 'W':
				word = wRuleEng(word);
				break;
			case 'X':
				word = xRuleEng(word);
				break;
			case 'Y':
				word = yRuleEng(word);
				break;
			case 'Z':
				word = zRuleEng(word);
				break;
			default:
				console.log("found a weird letter during NRL translation.");
				
		}
	}
	return(word.translated.trim());
}

function aRuleEng (word) {
	const aRules = [
		{letters: "A", regex: /a$/, phonemes: "AX", extra: 0}, //[A] =/AX/
		{letters: "ARE", regex: /^aRE$/, phonemes: "AA R", extra: 1}, // [ARE] =/AA R/
		{letters: "AR", regex: /^aRO/, phonemes: "AX R", extra: 1}, // [AR]O=/AX R/
		{letters: "AR", regex: /aR[AEIOUY]+/, phonemes: "EH R", extra: 0}, //[AR]#=/EH R/
		{letters: "AS", regex: /^[BCDFGHJKLMNPQRSTVWXZ]aS[AEIOUY]+/, phonemes: "EY S", extra: 2}, // ^[AS]#=/EY S/
		{letters: "A", regex: /aWA/, phonemes: "AX", extra: 0}, //[A]WA=/AX/
		{letters: "AW", regex: /aW/, phonemes: "AO", extra: 0}, //[AW]=/AO/
		{letters: "ANY", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*aNY/, phonemes: "EH N IY", extra: 1}, // :[ANY]=/EH N IY/
		{letters: "A", regex: /a[BCDFGHJKLMNPQRSTVWXZ][EIY][AEIOUY]+/, phonemes: "EY", extra: 0}, //[A]^+#=/EY/
		{letters: "ALLY", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*aLLY/, phonemes: "AX L IY", extra: NaN}, //#:[ALLY]=/AX L IY/
		{letters: "AL", regex: /^aL[AEIOUY]+/, phonemes: "AX L", extra: 1}, // [AL]#=/AX L/
		{letters: "AGAIN", regex: /aGAIN/, phonemes: "AX G EH N", extra: 0}, //[AGAIN]=/AX G EH N/
		{letters: "AG", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*aGE/, phonemes: "IH JH", extra: NaN}, //#:[AG]E=/IH JH/
		{letters: "A", regex: /a[BCDFGHJKLMNPQRSTVWXZ][EIY][BCDFGHJKLMNPQRSTVWXZ]*[AEIOUY]+/, phonemes: "AE", extra: 0}, //[A]^+:#=/AE/
		{letters: "A", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*a[BCDFGHJKLMNPQRSTVWXZ][EIY]$/, phonemes: "EY", extra: 1}, // :[A]^+ =/EY/
		{letters: "A", regex: /a[BCDFGHJKLMNPQRSTVWXZ](?:ER)|a[BCDFGHJKLMNPQRSTVWXZ](?:ES)|a[BCDFGHJKLMNPQRSTVWXZ](?:ED)|a[BCDFGHJKLMNPQRSTVWXZ](?:ING)|a[BCDFGHJKLMNPQRSTVWXZ]E/, phonemes: "EY", extra: 0}, //[A]^%=/EY/
		{letters: "ARR", regex: /^aRR/, phonemes: "AX R", extra: 1}, // [ARR]=/AX R/
		{letters: "ARR", regex: /aRR/, phonemes: "AE R", extra: 0}, //[ARR]=/AE R/
		{letters: "AR", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*aR$/, phonemes: "AA R", extra: 1}, // :[AR] =/AA R/
		{letters: "AR", regex: /aR$/, phonemes: "ER", extra: 0}, //[AR] =/ER/
		{letters: "AR", regex: /aR/, phonemes: "AA R", extra: 0}, //[AR]=/AA R/
		{letters: "AIR", regex: /aIR/, phonemes: "EH R", extra: 0}, //[AIR]=/EH R/
		{letters: "AI", regex: /aI/, phonemes: "EY", extra: 0}, //[AI]=/EY/
		{letters: "AY", regex: /aY/, phonemes: "EY", extra: 0}, //[AY]=/EY/
		{letters: "AU", regex: /aU/, phonemes: "AO", extra: 0}, //[AU]=/AO/
		{letters: "AL", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*aL$/, phonemes: "AX L", extra: NaN}, //#:[AL] =/AX L/
		{letters: "ALS", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*aLS$/, phonemes: "AX L Z", extra: NaN}, //#:[ALS] =/AX L Z/
		{letters: "ALK", regex: /aLK/, phonemes: "AO K", extra: 0}, //[ALK]=/AO K/
		{letters: "AL", regex: /aL[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "AO L", extra: 0}, //[AL]^=/AO L/
		{letters: "ABLE", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*aBLE/, phonemes: "EY B AX L", extra: 1}, // :[ABLE]=/EY B AX L/
		{letters: "ANG", regex: /aNG[EIY]/, phonemes: "EY N JH", extra: 0}, //[ANG]+=/EY N JH/
		{letters: "A", regex: /a/, phonemes: "AE", extra: 0} //[A]=/AE/
	];
	for(l=0; l<aRules.length; l++) {
		var translatedWord = translateNRLRule(word, aRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function bRuleEng (word) {
	const bRules = [
		{letters: "BE", regex: /^bE[BCDFGHJKLMNPQRSTVWXZ][AEIOUY]+/, phonemes: "B IH", extra: 1}, // [BE]^#=/B IH/
		{letters: "BEING", regex: /bEING/, phonemes: "B IY IH NX", extra: 0}, //[BEING]=/B IY IH NX/
		{letters: "BOTH", regex: /^bOTH$/, phonemes: "B OW TH", extra: 1}, // [BOTH] =/B OW TH/
		{letters: "BUS", regex: /^bUS[AEIOUY]+/, phonemes: "B IH Z", extra: 1}, // [BUS]#=/B IH Z/
		{letters: "BUIL", regex: /bUIL/, phonemes: "B IH L", extra: 0}, //[BUIL]=/B IH L/
		{letters: "B", regex: /b/, phonemes: "B", extra: 0} //[B]=/B/
	];
	for(l=0; l<bRules.length; l++) {
		var translatedWord = translateNRLRule(word, bRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function cRuleEng (word) {
	const cRules = [
		{letters: "CH", regex: /^cH[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "K", extra: 1}, // [CH]^=/K/
		{letters: "CH", regex: /[BCDFGHJKLMNPQRSTVWXZ]eCH/, phonemes: "K", extra: 3}, //^E[CH]=/K/
		{letters: "CH", regex: /cH/, phonemes: "CH", extra: 0}, //[CH]=/CH/
		{letters: "CI", regex: /^ScI[AEIOUY]+/, phonemes: "S AY", extra: 1}, // S[CI]#=/S AY/
		{letters: "CI", regex: /cIA/, phonemes: "SH", extra: 0}, //[CI]A=/SH/
		{letters: "CI", regex: /cIO/, phonemes: "SH", extra: 0}, //[CI]O=/SH/
		{letters: "CI", regex: /cIEN/, phonemes: "SH", extra: 0}, //[CI]EN=/SH/
		{letters: "C", regex: /c[EIY]/, phonemes: "S", extra: 0}, //[C]+=/S/
		{letters: "CK", regex: /cK/, phonemes: "K", extra: 0}, //[CK]=/K/
		{letters: "COM", regex: /cOM(?:ER)|cOM(?:ES)|cOM(?:ED)|cOM(?:ING)|cOME/, phonemes: "K AH M", extra: 0}, //[COM]%=/K AH M/
		{letters: "C", regex: /c/, phonemes: "K", extra: 0} //[C]=/K/
	];
	for(l=0; l<cRules.length; l++) {
		var translatedWord = translateNRLRule(word, cRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function dRuleEng (word) {
	const dRules = [
		{letters: "DED", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*dED$/, phonemes: "D IH D", extra: NaN}, //#:[DED] =/D IH D/
		{letters: "D", regex: /[BDVGJLMNRWZ]Ed$/, phonemes: "D", extra: 2}, //.E[D] =/D/
		{letters: "D", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*Ed$/, phonemes: "T", extra: NaN}, //#^:E[D] =/T/
		{letters: "DO", regex: /^dO$/, phonemes: "D UW", extra: 1}, // [DO] =/D UW/
		{letters: "DOES", regex: /^dOES/, phonemes: "D AH Z", extra: 1}, // [DOES]=/D AH Z/
		{letters: "DOING", regex: /^dOING/, phonemes: "D UW IH NX", extra: 1}, // [DOING]=/D UW IH NX/
		{letters: "DOW", regex: /^dOW/, phonemes: "D AW", extra: 1}, // [DOW]=/D AW/
		{letters: "DU", regex: /dUA/, phonemes: "JH UW", extra: 0}, //[DU]A=/JH UW/
		{letters: "D", regex: /d/, phonemes: "D", extra: 0} //[D]=/D/
	];
	for(l=0; l<dRules.length; l++) {
		var translatedWord = translateNRLRule(word, dRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function eRuleEng (word) {
	const eRules = [
		{letters: "E", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*e$/, phonemes: "", extra: NaN}, //#:[E] =/ /
		{letters: "E", regex: /^[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*e$/, phonemes: "", extra: NaN}, // ^:[E] =/ /
		{ letters: "E", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*e$/, phonemes: "IY", extra: NaN}, // :[E] =/IY/
		{letters: "ED", regex: /[AEIOUY]+eD$/, phonemes: "D", extra: NaN}, //#[ED] =/D/
		{letters: "E", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eD$/, phonemes: "", extra: NaN}, //#:[E]D =/ /
		{letters: "EV", regex: /eVER/, phonemes: "EH V", extra: NaN}, //[EV]ER=/EH V/
		{letters: "E", regex: /e[BCDFGHJKLMNPQRSTVWXZ](?:ER)|e[BCDFGHJKLMNPQRSTVWXZ](?:ES)|e[BCDFGHJKLMNPQRSTVWXZ](?:ED)|e[BCDFGHJKLMNPQRSTVWXZ](?:ING)|e[BCDFGHJKLMNPQRSTVWXZ]E/, phonemes: "IY", extra: 0}, //[E]^%=/IY/
		{letters: "ERI", regex: /eRI[AEIOUY]+/, phonemes: "IY R IY", extra: 0}, //[ERI]#=/IY R IY/
		{letters: "ERI", regex: /eRI/, phonemes: "EH R IH", extra: 0}, //[ERI]=/EH R IH/
		{letters: "ER", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eR[AEIOUY]+/, phonemes: "ER", extra: NaN}, //#:[ER]#=/ER/
		{letters: "ER", regex: /eR[AEIOUY]+/, phonemes: "EH R", extra: 0}, //[ER]#=/EH R/
		{letters: "ER", regex: /eR/, phonemes: "ER", extra: 0}, //[ER]=/ER/
		{letters: "EVEN", regex: /^eVEN/, phonemes: "IY V EH N", extra: 1}, // [EVEN]=/IY V EH N/
		{letters: "E", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eW/, phonemes: "", extra: NaN}, //#:[E]W=/ /
		{letters: "EW", regex: /(?:CH)eW|(?:SH)eW|(?:TH)eW|[TSRDLZNJ]eW/, phonemes: "UW", extra: 2}, //@[EW]=/UW/
		{letters: "EW", regex: /eW/, phonemes: "Y UW", extra: 0}, //[EW]=/Y UW/
		{letters: "E", regex: /eO/, phonemes: "IY", extra: 0}, //[E]O=/IY/
		{letters: "ES", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*(?:CH)eS|[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*(?:SH)eS|[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*[SCGZXJ]eS$/, phonemes: "IH Z", extra: NaN}, //#:&[ES] =/IH Z/
		{letters: "E", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eS$/, phonemes: "", extra: NaN}, //#:[E]S =/ /
		{letters: "ELY", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eLY$/, phonemes: "L IY", extra: NaN}, //#:[ELY] =/L IY/
		{letters: "EMENT", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eMENT/, phonemes: "M EH N T", extra: NaN}, //#:[EMENT]=/M EH N T/
		{letters: "EFUL", regex: /eFUL/, phonemes: "F UH L", extra: 0}, //[EFUL]=/F UH L/
		{letters: "EE", regex: /eE/, phonemes: "IY", extra: 0}, //[EE]=/IY/
		{letters: "EARN", regex: /eARN/, phonemes: "ER N", extra: 0}, //[EARN]=/ER N/
		{letters: "EAR", regex: /^eAR[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "ER", extra: 1}, // [EAR]^=/ER/
		{letters: "EAD", regex: /eAD/, phonemes: "EH D", extra: 0}, //[EAD]=/EH D/
		{letters: "EA", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*eA$/, phonemes: "IY AX", extra: NaN}, //#:[EA] =/IY AX/
		{letters: "EA", regex: /eASU/, phonemes: "EH", extra: 0}, //[EA]SU=/EH/
		{letters: "EA", regex: /eA/, phonemes: "IY", extra: 0}, //[EA]=/IY/
		{letters: "EIGH", regex: /eIGH/, phonemes: "EY", extra: 0}, //[EIGH]=/EY/
		{letters: "EI", regex: /eI/, phonemes: "IY", extra: 0}, //[EI]=/IY/
		{letters: "EYE", regex: /^eYE/, phonemes: "AY", extra: 1}, // [EYE]=/AY/
		{letters: "EY", regex: /eY/, phonemes: "IY", extra: 0}, //[EY]=/IY/
		{letters: "EU", regex: /eU/, phonemes: "Y UW", extra: 0}, //[EU]=/Y UW/
		{letters: "E", regex: /e/, phonemes: "EH", extra: 0} //[E]=/EH/
	];
	for(l=0; l<eRules.length; l++) {
		var translatedWord = translateNRLRule(word, eRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function fRuleEng (word) {
	const fRules = [
		{letters: "FUL", regex: /fUL/, phonemes: "F UH L", extra: 0}, //[FUL]=/F UH L/
		{letters: "F", regex: /f/, phonemes: "F", extra: 0} //[F]=/F/
	];
	for(l=0; l<fRules.length; l++) {
		var translatedWord = translateNRLRule(word, fRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function gRuleEng (word) {
	const gRules = [
		{letters: "GIV", regex: /gIV/, phonemes: "G IH V", extra: 0}, //[GIV]=/G IH V/
		{letters: "G", regex: /^gI[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "G", extra: 1}, // [G]I^=/G/
		{letters: "GGES", regex: /SUgGES/, phonemes: "G JH EH S", extra: 2}, //SU[GGES]=/G JH EH S/
		{letters: "GG", regex: /gG/, phonemes: "G", extra: 0}, //[GG]=/G/
		{letters: "G", regex: /^B[AEIOUY]+g/, phonemes: "G", extra: NaN}, // B#[G]=/G/
		{letters: "G", regex: /g[EIY]/, phonemes: "G", extra: 0}, //[G]+=/JH/
		{letters: "GREAT", regex: /gREAT/, phonemes: "G R EY T", extra: 0}, //[GREAT]=/G R EY T/
		{letters: "GH", regex: /[AEIOUY]+gH/, phonemes: "", extra: NaN}, //#[GH]=/ /
		{letters: "G", regex: /g/, phonemes: "G", extra: 0} //[G]=/G/
	];
	for(l=0; l<gRules.length; l++) {
		var translatedWord = translateNRLRule(word, gRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function hRuleEng (word) {
	const hRules = [
		{letters: "HAV", regex: /^hAV/, phonemes: "HH AE V", extra: 1}, // [HAV]=/HH AE V/
		{letters: "HERE", regex: /^hERE/, phonemes: "HH IY R", extra: 1}, // [HERE]=/HH IY R/
		{letters: "HOUR", regex: /^hOUR/, phonemes: "AW ER", extra: 1}, // [HOUR]=/AW ER/
		{letters: "HOW", regex: /hOW/, phonemes: "HH AW", extra: 0}, //[HOW]=/HH AW/
		{letters: "H", regex: /h[AEIOUY]+/, phonemes: "HH", extra: 0}, //[H]#=/HH/
		{letters: "H", regex: /h/, phonemes: "", extra: 0} //[H]=/ /
	];
	for(l=0; l<hRules.length; l++) {
		var translatedWord = translateNRLRule(word, hRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function iRuleEng (word) {
	const iRules = [
		{letters: "IN", regex: /^iN/, phonemes: "IH N", extra: 1}, // [IN]=/IH N/
		{letters: "I", regex: /^i$/, phonemes: "AY", extra: 1}, // [I] =/AY/
		{letters: "IN", regex: /iND/, phonemes: "AY N", extra: 0}, //[IN]D=/AY N/
		{letters: "IER", regex: /iER/, phonemes: "IY ER", extra: 0}, //[IER]=/IY ER/
		{letters: "IED", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*RiED$/, phonemes: "IY D", extra: NaN}, //#:R[IED] =/IY D/
		{letters: "IED", regex: /iED$/, phonemes: "AY D", extra: 0}, //[IED] =/AY D/
		{letters: "IEN", regex: /iEN/, phonemes: "IY EH N", extra: 0}, //[IEN]=/IY EH N/
		{letters: "IE", regex: /iET/, phonemes: "AY EH", extra: 0}, //[IE]T=/AY EH/
		{letters: "I", regex: /i(?:ER)|i(?:ES)|i(?:ED)|i(?:ING)|iE/, phonemes: "IY", extra: 0}, //[I]%=/IY/
		{letters: "IE", regex: /iE/, phonemes: "IY", extra: 0}, //[IE]=/IY/
		{letters: "I", regex: /i[BCDFGHJKLMNPQRSTVWXZ][EIY][BCDFGHJKLMNPQRSTVWXZ]*[AEIOUY]+/, phonemes: "IH", extra: 0}, //[I]^+:#=/IH/
		{letters: "IR", regex: /iR[AEIOUY]+/, phonemes: "AY R", extra: 0}, //[IR]#=/AY R/
		{letters: "IZ", regex: /iZ(?:ER)|iZ(?:ES)|iZ(?:ED)|iZ(?:ING)|iZE/, phonemes: "AY Z", extra: 0}, //[IZ]%=/AY Z/
		{letters: "IS", regex: /iS(?:ER)|iS(?:ES)|iS(?:ED)|iS(?:ING)|iSE/, phonemes: "AY Z", extra: 0}, //[IS]%=/AY Z/
		{letters: "I", regex: /iD(?:ER)|iD(?:ES)|iD(?:ED)|iD(?:ING)|iDE/, phonemes: "AY", extra: 0}, //[I]D%=/AY/
		{letters: "I", regex: /[EIY][BCDFGHJKLMNPQRSTVWXZ]i[BCDFGHJKLMNPQRSTVWXZ][EIY]/, phonemes: "IH", extra: 4}, //+^[I]^+=/IH/
		{letters: "I", regex: /iT(?:ER)|iT(?:ES)|iT(?:ED)|iT(?:ING)|iTE/, phonemes: "AY", extra: 0}, //[I]T%=/AY/
		{letters: "I", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*i[BCDFGHJKLMNPQRSTVWXZ][EIY]/, phonemes: "IH", extra: NaN}, //#^:[I]^+=/IH/
		{letters: "I", regex: /i[BCDFGHJKLMNPQRSTVWXZ][EIY]/, phonemes: "AY", extra: 0}, //[I]^+=/AY/
		{letters: "IR", regex: /iR/, phonemes: "ER", extra: 0}, //[IR]=/ER/
		{letters: "IGH", regex: /iGH/, phonemes: "AY", extra: 0}, //[IGH]=/AY/
		{letters: "ILD", regex: /iLD/, phonemes: "AY L D", extra: 0}, //[ILD]=/AY L D/
		{letters: "IGN", regex: /iGN$/, phonemes: "AY N", extra: 0}, //[IGN] =/AY N/
		{letters: "IGN", regex: /iGN[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "AY N", extra: 0}, //[IGN]^=/AY N/
		{letters: "IGN", regex: /iGN(?:ER)|iGN(?:ES)|iGN(?:ED)|iGN(?:ING)|iGNE/, phonemes: "AY N", extra: 0}, //[IGN]%=/AY N/
		{letters: "IQUE", regex: /iQUE/, phonemes: "IY K", extra: 0}, //[IQUE]=/IY K/
		{letters: "I", regex: /i/, phonemes: "IH", extra: 0} //[I]=/IH/
	];
	for(l=0; l<iRules.length; l++) {
		var translatedWord = translateNRLRule(word, iRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function jRuleEng (word) {
	const jRules = [
		{letters: "J", regex: /j/, phonemes: "JH", extra: 0} //[J]=/JH/
	];
	for(l=0; l<jRules.length; l++) {
		var translatedWord = translateNRLRule(word, jRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function kRuleEng (word) {
	const kRules = [
		{letters: "K", regex: /^kN/, phonemes: "", extra: 1}, // [K]=/ /
		{letters: "K", regex: /k/, phonemes: "K", extra: 0} //[K]=/K/
	];
	for(l=0; l<kRules.length; l++) {
		var translatedWord = translateNRLRule(word, kRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function lRuleEng (word) {
	const lRules = [
		{letters: "LO", regex: /lOC[AEIOUY]+/, phonemes: "L OW", extra: 0}, //[LO]C#=/L OW/
		{letters: "L", regex: /^Ll/, phonemes: "", extra: 1}, //L[L]=/ /
		{letters: "L", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*l(?:ER)|[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*l(?:ES)|[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*l(?:ED)|[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*l(?:ING)|[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*lE/, phonemes: "AX L", extra: NaN}, //#^:[L]%=/AX L/
		{letters: "LEAD", regex: /lEAD/, phonemes: "L IY D", extra: 0}, //[LEAD]=/L IY D/
		{letters: "L", regex: /l/, phonemes: "L", extra: 0} //[L]=/L/
	];
	for(l=0; l<lRules.length; l++) {
		var translatedWord = translateNRLRule(word, lRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function mRuleEng (word) {
	const mRules = [
		{letters: "MOV", regex: /mOV/, phonemes: "M UW V", extra: 0}, //[MOV]=/M UW V/
		{letters: "M", regex: /m/, phonemes: "M", extra: 0} //[M]=/M/
	];
	for(l=0; l<mRules.length; l++) {
		var translatedWord = translateNRLRule(word, mRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function nRuleEng (word) {
	const nRules = [
		{letters: "NG", regex: /EnG[EIY]/, phonemes: "N JH", extra: 1}, //E[NG]+=/N JH/
		{letters: "NG", regex: /nGR/, phonemes: "NX G", extra: 0}, //[NG]R=/NX G/
		{letters: "NG", regex: /nG[AEIOUY]+/, phonemes: "NX G", extra: 0}, //[NG]#=/NX G/
		{letters: "NGL", regex: /nGL(?:ER)|nGL(?:ES)|nGL(?:ED)|nGL(?:ING)|nGLE/, phonemes: "NX G AX L", extra: 0}, //[NGL]%=/NX G AX L/
		{letters: "NG", regex: /nG/, phonemes: "NX", extra: 0}, //[NG]=/NX/
		{letters: "NK", regex: /nK/, phonemes: "NX K", extra: 0}, //[NK]=/NX K/
		{letters: "NOW", regex: /^nOW$/, phonemes: "N AW", extra: 1}, // [NOW] =/N AW/
		{letters: "N", regex: /n/, phonemes: "N", extra: 0} //[N]=/N/
	];
	for(l=0; l<nRules.length; l++) {
		var translatedWord = translateNRLRule(word, nRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function oRuleEng (word) {
	const oRules = [
		{letters: "OF", regex: /oF$/, phonemes: "AX V", extra: 0}, //[OF] =/AX V/
		{letters: "OROUGH", regex: /oROUGH/, phonemes: "ER OW", extra: 0}, //[OROUGH] =/ER OW/
		{letters: "OR", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*oR$/, phonemes: "ER", extra: NaN}, //#:[OR] =/ER/
		{letters: "ORS", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*oRS$/, phonemes: "ER Z", extra: NaN}, //#:[ORS] =/ER Z/
		{letters: "OR", regex: /oR/, phonemes: "AO R", extra: 0}, //[OR]=/AO R/
		{letters: "ONE", regex: /^oNE/, phonemes: "W AH N", extra: 1}, // [ONE]=/W AH N/
		{letters: "OW", regex: /oW/, phonemes: "OW", extra: 0}, //[OW]=/OW/
		{letters: "OVER", regex: /^oVER/, phonemes: "OW V ER", extra: 1}, // [OVER]=/OW V ER/
		{letters: "OV", regex: /oV/, phonemes: "AH V", extra: 0}, //[OV]=/AH V/
		{letters: "O", regex: /o[BCDFGHJKLMNPQRSTVWXZ](?:ER)|o[BCDFGHJKLMNPQRSTVWXZ](?:ES)|o[BCDFGHJKLMNPQRSTVWXZ](?:ED)|o[BCDFGHJKLMNPQRSTVWXZ](?:ING)|o[BCDFGHJKLMNPQRSTVWXZ]E/, phonemes: "OW", extra: 0}, //[O]^%=/OW/
		{letters: "O", regex: /o[BCDFGHJKLMNPQRSTVWXZ]EN/, phonemes: "OW", extra: 0}, //[O]^EN=/OW/
		{letters: "O", regex: /o[BCDFGHJKLMNPQRSTVWXZ]I[AEIOUY]+/, phonemes: "OW", extra: 0}, //[O]^I#=/OW/
		{letters: "OL", regex: /oLD/, phonemes: "OW L", extra: 0}, //[OL]D=/OW L/
		{letters: "OUGHT", regex: /oUGHT/, phonemes: "AO T", extra: 0}, //[OUGHT]=/AO T/
		{letters: "OUGH", regex: /oUGH/, phonemes: "AH F", extra: 0}, //[OUGH]=/AH F/
		{letters: "OU", regex: /^oU/, phonemes: "AW", extra: 1}, // [OU]=/AW/
		{letters: "OU", regex: /HoUS[AEIOUY]+/, phonemes: "AW", extra: 1}, //H[OU]S#=/AW/
		{letters: "OUS", regex: /oUS/, phonemes: "AX S", extra: 0}, //[OUS]=/AX S/
		{letters: "OUR", regex: /oUR/, phonemes: "AO R", extra: 0}, //[OUR]=/AO R/
		{letters: "OULD", regex: /oULD/, phonemes: "UH D", extra: 0}, //[OULD]=/UH D/
		{letters: "OU", regex: /[BCDFGHJKLMNPQRSTVWXZ]OU[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "AH", extra: 2}, //^[OU]^L=/AH/
		{letters: "OUP", regex: /oUP/, phonemes: "UW P", extra: 0}, //[OUP]=/UW P/
		{letters: "OU", regex: /oU/, phonemes: "AW", extra: 0}, //[OU]=/AW/
		{letters: "OY", regex: /oY/, phonemes: "OY", extra: 0}, //[OY]=/OY/
		{letters: "OING", regex: /oING/, phonemes: "OW IH NX", extra: 0}, //[OING]=/OW IH NX/
		{letters: "OI", regex: /oI/, phonemes: "OY", extra: 0}, //[OI]=/OY/
		{letters: "OOR", regex: /oOR/, phonemes: "AO R", extra: 0}, //[OOR]=/AO R/
		{letters: "OOK", regex: /oOK/, phonemes: "UH K", extra: 0}, //[OOK]=/UH K/
		{letters: "OOD", regex: /oOD/, phonemes: "UH D", extra: 0}, //[OOD]=/UH D/
		{letters: "OO", regex: /oO/, phonemes: "UW", extra: 0}, //[OO]=/UW/
		{letters: "OE", regex: /oE/, phonemes: "OW", extra: 0}, //[O]E=/OW/
		{letters: "O", regex: /o$/, phonemes: "OW", extra: 0}, //[O] =/OW/
		{letters: "OA", regex: /oA/, phonemes: "OW", extra: 0}, //[OA]=/OW/
		{letters: "ONLY", regex: /^oNLY/, phonemes: "OW N L IY", extra: 1}, // [ONLY]=/OW N L IY/
		{letters: "ONCE", regex: /^oNCE/, phonemes: "W AH N S", extra: 1}, // [ONCE]=/W AH N S/
		{letters: "ON'T", regex: /oN'T/, phonemes: "OW N T", extra: 0}, //[ON'T]=/OW N T/
		{letters: "O", regex: /CoN/, phonemes: "AA", extra: 1}, //C[O]N=/AA/
		{letters: "O", regex: /oNG/, phonemes: "AO", extra: 0}, //[O]NG=/AO/
		{letters: "O", regex: /[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*oN/, phonemes: "AH", extra: NaN}, //^:[O]N=/AH/
		{letters: "ON", regex: /IoN/, phonemes: "AX N", extra: 1}, //I[ON]=/AX N/
		{letters: "ON", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*oN$/, phonemes: "AX N", extra: NaN}, //#:[ON] =/AX N/
		{letters: "ON", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]oN/, phonemes: "AX N", extra: NaN}, //#^[ON]=/AX N/
		{letters: "O", regex: /oST$/, phonemes: "OW", extra: 0}, //[O]ST =/OW/
		{letters: "OF", regex: /oF[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "AO F", extra: 0}, //[OF]^=/AO F/
		{letters: "OTHER", regex: /oTHER/, phonemes: "AH DH ER", extra: 0}, //[OTHER]=/AH DH ER/
		{letters: "OSS", regex: /oSS/, phonemes: "AO S", extra: 0}, //[OSS] =/AO S/
		{letters: "OM", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*oM/, phonemes: "AH M", extra: NaN}, //#^:[OM]=/AH M/
		{letters: "O", regex: /o/, phonemes: "AA", extra: 0} //[O]=/AA/
	];
	for(l=0; l<oRules.length; l++) {
		var translatedWord = translateNRLRule(word, oRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function pRuleEng (word) {
	const pRules = [
		{letters: "PH", regex: /pH/, phonemes: "F", extra: 0}, //[PH]=/F/
		{letters: "PEOP", regex: /pEOP/, phonemes: "P IY P", extra: 0}, //[PEOP]=/P IY P/
		{letters: "POW", regex: /pOW/, phonemes: "P AW", extra: 0}, //[POW]=/P AW/
		{letters: "PUT", regex: /pUT$/, phonemes: "P UH T", extra: 0}, //[PUT] =/P UH T/
		{letters: "P", regex: /p/, phonemes: "P", extra: 0} //[P]=/P/
	];
	for(l=0; l<pRules.length; l++) {
		var translatedWord = translateNRLRule(word, pRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function qRuleEng (word) {
	const qRules = [
		{letters: "QUAR", regex: /qUAR/, phonemes: "K W AO R", extra: 0}, //[QUAR]=/K W AO R/
		{letters: "QU", regex: /qU/, phonemes: "K W", extra: 0}, //[QU]=/K W/
		{letters: "Q", regex: /q/, phonemes: "K", extra: 0}, //[Q]=/K/
	];
	for(l=0; l<qRules.length; l++) {
		var translatedWord = translateNRLRule(word, qRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function rRuleEng (word) {
	const rRules = [
		{letters: "RE", regex: /^rE[BCDFGHJKLMNPQRSTVWXZ][AEIOUY]+/, phonemes: "R IY", extra: 1}, // [RE]^#=/R IY/
		{letters: "R", regex: /r/, phonemes: "R", extra: 0} //[R]=/R/
	];
	for(l=0; l<rRules.length; l++) {
		var translatedWord = translateNRLRule(word, rRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function sRuleEng (word) {
	const sRules = [
		{letters: "SH", regex: /sH/, phonemes: "SH", extra: 0}, //[SH]=/SH/
		{letters: "SION", regex: /[AEIOUY]+sION/, phonemes: "ZH AX N", extra: 1}, //#[SION]=/ZH AX N/
		{letters: "SOME", regex: /sOME/, phonemes: "S AH M", extra: 0}, //[SOME]=/S AH M/
		{letters: "SUR", regex: /[AEIOUY]+sUR[AEIOUY]+/, phonemes: "ZH ER", extra: 1}, //#[SUR]#=/ZH ER/
		{letters: "SUR", regex: /sUR[AEIOUY]+/, phonemes: "SH ER", extra: 0}, //[SUR]#=/SH ER/
		{letters: "SU", regex: /[AEIOUY]+sU[AEIOUY]+/, phonemes: "ZH UW", extra: 1}, //#[SU]#=/ZH UW/
		{letters: "SSU", regex: /[AEIOUY]+sSU[AEIOUY]+/, phonemes: "SH UW", extra: 1}, //#[SSU]#=/SH UW/
		{letters: "SED", regex: /[AEIOUY]+sED$/, phonemes: "Z D", extra: 1}, //#[SED] =/Z D/
		{letters: "S", regex: /[AEIOUY]+s[AEIOUY]+/, phonemes: "Z", extra: 1}, //#[S]#=/Z/
		{letters: "SAID", regex: /sAID/, phonemes: "S EH D", extra: 0}, //[SAID]=/S EH D/
		{letters: "SION", regex: /[BCDFGHJKLMNPQRSTVWXZ]sION/, phonemes: "SH AX N", extra: 2}, //^[SION]=/SH AX N/
		{letters: "S", regex: /sS/, phonemes: "", extra: 0}, //[S]S=/ /
		{letters: "S", regex: /[BDVGJLMNRWZ]s$/, phonemes: "Z", extra: 2}, //.[S] =/Z/
		{letters: "S", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*[BDVGJLMNRWZ]es$/, phonemes: "Z", extra: NaN}, //#:.E[S] =/Z/
		{letters: "S", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*[AEIOUY]+[AEIOUY]+s$/, phonemes: "Z", extra: NaN}, //#^:##[S] =/Z/
		{letters: "S", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*[AEIOUY]+s$/, phonemes: "S", extra: NaN}, //#^:#[S] =/S/
		{letters: "S", regex: /Us$/, phonemes: "S", extra: 1}, //U[S] =/S/
		{letters: "S", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*[AEIOUY]+s$/, phonemes: "Z", extra: NaN}, // :#[S] =/Z/
		{letters: "SCH", regex: /^sCH/, phonemes: "S K", extra: 0}, // [SCH]=/S K/
		{letters: "S", regex: /sC[EIY]/, phonemes: "", extra: 0}, //[S]C+=/ /
		{letters: "S", regex: /[AEIOUY]+sM/, phonemes: "Z M", extra: 1}, //#[SM]=/Z M/
		{letters: "SN'", regex: /sN'/, phonemes: "Z AX N", extra: 1}, //#[SN]'=/Z AX N/
		{letters: "S", regex: /s/, phonemes: "S", extra: 0} //[S]=/S/
	];
	for(l=0; l<sRules.length; l++) {
		var translatedWord = translateNRLRule(word, sRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function tRuleEng (word) {
	const tRules = [
		{letters: "THE", regex: /^tHE$/, phonemes: "DH AX", extra: 1}, // [THE] =/DH AX/
		{letters: "TO", regex: /tO$/, phonemes: "T UW", extra: 0}, //[TO] =/T UW/
		{letters: "THAT", regex: /tHAT$/, phonemes: "DH AE T", extra: 0}, //[THAT] =/DH AE T/
		{letters: "THIS", regex: /^tHIS$/, phonemes: "DH IH S", extra: 1}, // [THIS] =/DH IH S/
		{letters: "THEY", regex: /^tHEY/, phonemes: "DH EY", extra: 1}, // [THEY]=/DH EY/
		{letters: "THERE", regex: /^tHERE/, phonemes: "DH EH R", extra: 1}, // [THERE]=/DH EH R/
		{letters: "THER", regex: /tHER/, phonemes: "DH ER", extra: 0}, //[THER]=/DH ER/
		{letters: "THEIR", regex: /tHEIR/, phonemes: "DH EH R", extra: 0}, //[THEIR]=/DH EH R/
		{letters: "THAN", regex: /^tHAN$/, phonemes: "DH AE N", extra: 1}, // [THAN] =/DH AE N/
		{letters: "THEM", regex: /^tHEM$/, phonemes: "DH EH M", extra: 1}, // [THEM] =/DH EH M/
		{letters: "THESE", regex: /tHESE$/, phonemes: "DH IY Z", extra: 0}, //[THESE] =/DH IY Z/
		{letters: "THEN", regex: /^tHEN/, phonemes: "DH EH N", extra: 1}, // [THEN]=/DH EH N/
		{letters: "THROUGH", regex: /tHROUGH/, phonemes: "TH R UW", extra: 0}, //[THROUGH]=/TH R UW/
		{letters: "THOSE", regex: /tHOSE/, phonemes: "DH OW Z", extra: 0}, //[THOSE]=/DH OW Z/
		{letters: "THOUGH", regex: /tHOUGH$/, phonemes: "DH OW", extra: 0}, //[THOUGH] =/DH OW/
		{letters: "THUS", regex: /^tHUS/, phonemes: "DH AH S", extra: 1}, // [THUS]=/DH AH S/
		{letters: "TH", regex: /tH/, phonemes: "TH", extra: 0}, //[TH]=/TH/
		{letters: "TED", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ]*tED$/, phonemes: "T IH D", extra: NaN}, //#:[TED] =/T IH D/
		{letters: "TI", regex: /StI[AEIOUY]+N/, phonemes: "CH", extra: 0}, //S[TI]#N=/CH/
		{letters: "TI", regex: /tIO/, phonemes: "SH", extra: 0}, //[TI]O=/SH/
		{letters: "TI", regex: /tIA/, phonemes: "SH", extra: 0}, //[TI]A=/SH/
		{letters: "TIEN", regex: /tIEN/, phonemes: "SH AX N", extra: 0}, //[TIEN]=/SH AX N/
		{letters: "TUR", regex: /tUR[AEIOUY]+/, phonemes: "CH ER", extra: 0}, //[TUR]#=/CH ER/
		{letters: "TU", regex: /tUA/, phonemes: "CH UW", extra: 0}, //[TU]A=/CH UW/
		{letters: "TWO", regex: /^tWO/, phonemes: "T UW", extra: 1}, // [TWO]=/T UW/
		{letters: "T", regex: /t/, phonemes: "T", extra: 0} //[T]=/T/
	];
	for(l=0; l<tRules.length; l++) {
		var translatedWord = translateNRLRule(word, tRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function uRuleEng (word) {
	const uRules = [
		{letters: "UN", regex: /^uNI/, phonemes: "Y UW N", extra: 1}, // [UN]I=/Y UW N/
		{letters: "UN", regex: /^uN/, phonemes: "AH N", extra: 1}, // [UN]=/AH N/
		{letters: "UPON", regex: /^uPON/, phonemes: "AX P AO N", extra: 1}, // [UPON]=/AX P AO N/
		{letters: "UR", regex: /(?:CH)uR[AEIOUY]+|(?:SH)uR[AEIOUY]+|(?:TH)uR[AEIOUY]+|[TSRDLZNJ]uR[AEIOUY]+/, phonemes: "UH R", extra: 1}, //@[UR]#=/UH R/
		{letters: "UR", regex: /uR[AEIOUY]+/, phonemes: "Y UH R", extra: 0}, //[UR]#=/Y UH R/
		{letters: "UR", regex: /uR/, phonemes: "ER", extra: 0}, //[UR]=/ER/
		{letters: "U", regex: /u[BCDFGHJKLMNPQRSTVWXZ]$/, phonemes: "AH", extra: 0}, //[U]^ =/AH/
		{letters: "U", regex: /u[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "AH", extra: 0}, //[U]^^=/AH/
		{letters: "U", regex: /uY/, phonemes: "AY", extra: 0}, //[UY]=/AY/
		{letters: "U", regex: /^Gu[AEIOUY]+/, phonemes: "", extra: 2}, // G[U]#=/ /
		{letters: "U", regex: /Gu(?:ER)|Gu(?:ES)|Gu(?:ED)|Gu(?:ING)|GuE/, phonemes: "", extra: 2}, //G[U]%=/ /
		{letters: "U", regex: /Gu[AEIOUY]+/, phonemes: "W", extra: 1}, //G[U]#=/W/
		{letters: "U", regex: /[AEIOUY]+Nu/, phonemes: "Y UW", extra: 2}, //#N[U]=/Y UW/
		{letters: "U", regex: /(?:CH)u|(?:SH)u|(?:TH)u|[TSRDLZNJ]u/, phonemes: "UW", extra: 1}, //@[U]=/UW/
		{letters: "U", regex: /u/, phonemes: "Y UW", extra: 0} //[U]=/Y UW/
	];
	for(l=0; l<uRules.length; l++) {
		var translatedWord = translateNRLRule(word, uRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function vRuleEng (word) {
	const vRules = [
		{letters: "VIEW", regex: /vIEW/, phonemes: "V Y UW", extra: 0}, //[VIEW]=/V Y UW/
		{letters: "V", regex: /v/, phonemes: "V", extra: 0} //[V]=/V/
	];
	for(l=0; l<vRules.length; l++) {
		var translatedWord = translateNRLRule(word, vRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function wRuleEng (word) {
	const wRules = [
		{letters: "WERE", regex: /^wERE/, phonemes: "W ER", extra: 1}, // [WERE]=/W ER/
		{letters: "WA", regex: /wAS/, phonemes: "W AA", extra: 0}, //[WA]S=/W AA/
		{letters: "WA", regex: /wAT/, phonemes: "W AA", extra: 0}, //[WA]T=/W AA/
		{letters: "WHERE", regex: /wHERE/, phonemes: "WH EH R", extra: 0}, //[WHERE]=/WH EH R/
		{letters: "WHAT", regex: /wHAT/, phonemes: "WH AA T", extra: 0}, //[WHAT]=/WH AA T/
		{letters: "WHOL", regex: /wHOL/, phonemes: "HH OW L", extra: 0}, //[WHOL]=/HH OW L/
		{letters: "WHO", regex: /wHO/, phonemes: "HH UW", extra: 0}, //[WHO]=/HH UW/
		{letters: "WH", regex: /wH/, phonemes: "WH", extra: 0}, //[WH]=/WH/
		{letters: "WAR", regex: /wAR/, phonemes: "W AO R", extra: 0}, //[WAR]=/W AO R/
		{letters: "WOR", regex: /wOR[BCDFGHJKLMNPQRSTVWXZ]/, phonemes: "W ER", extra: 0}, //[WOR]^=/W ER/
		{letters: "WR", regex: /wR/, phonemes: "WR", extra: 0}, //[WR]=/R/
		{letters: "W", regex: /w/, phonemes: "W", extra: 0} //[W]=/W/
	];
	for(l=0; l<wRules.length; l++) {
		var translatedWord = translateNRLRule(word, wRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function xRuleEng (word) {
	const xRules = [
		{letters: "X", regex: /x/, phonemes: "K S", extra: 0} //[X]=/K S/
	];
	for(l=0; l<xRules.length; l++) {
		var translatedWord = translateNRLRule(word, xRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function yRuleEng (word) {
	const yRules = [
		{letters: "YOUNG", regex: /yOUNG/, phonemes: "Y AH NX", extra: 0}, //[YOUNG]=/Y AH NX/
		{letters: "YOU", regex: /^you/, phonemes: "Y UW", extra: 1}, // [YOU]=/Y UW/
		{letters: "YES", regex: /^yes/, phonemes: "Y EH S", extra: 1}, // [YES]=/Y EH S/
		{letters: "Y", regex: /^y/, phonemes: "Y", extra: 1}, // [Y]=/Y/
		{ letters: "Y", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*y$/, phonemes: "IY", extra: NaN}, //#^:[Y] =/IY/
		{ letters: "Y", regex: /[AEIOUY]+[BCDFGHJKLMNPQRSTVWXZ][BCDFGHJKLMNPQRSTVWXZ]*yi/, phonemes: "IY", extra: NaN}, //#^:[Y]I=/IY/
		{ letters: "Y", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*y$/, phonemes: "AY", extra: NaN}, // :[Y] =/AY/
		{ letters: "Y", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*y[AEIOUY]+/, phonemes: "AY", extra: NaN}, // :[Y]#=/AY/
		{ letters: "Y", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*y[BCDFGHJKLMNPQRSTVWXZ][EIY][BCDFGHJKLMNPQRSTVWXZ]*[AEIOUY]+/, phonemes: "IH", extra: NaN}, // :[Y]^+:#=/IH/
		{ letters: "Y", regex: /^[BCDFGHJKLMNPQRSTVWXZ]*y[BCDFGHJKLMNPQRSTVWXZ][AEIOUY]+/, phonemes: "AY", extra: NaN}, // :[Y]^#=/AY/
		{letters: "Y", regex: /y/, phonemes: "IH", extra: 0} //[Y]=/IH/
	];
	for(l=0; l<yRules.length; l++) {
		var translatedWord = translateNRLRule(word, yRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

function zRuleEng (word) {
	const zRules = [
		{letters: "Z", regex: /z/, phonemes: "Z", extra: 0} //[Z]=/Z/
	];
	for(l=0; l<zRules.length; l++) {
		var translatedWord = translateNRLRule(word, zRules[l]);
		if(translatedWord) {
			break;
		}
	}
	return translatedWord;
}

//=================================================================
//===== Number to words conversion ================================
//=================================================================

/*
	Retrieved From: http://stackoverflow.com/a/5530230/3171303
	Author: MAK - https://stackoverflow.com/users/125382/mak
	License: CC By-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/
*/

var ones=['','one','two','three','four','five','six','seven','eight','nine'];
var tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
var teens=['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];


function convert_millions(num){
    if (num>=1000000){
        return convert_millions(Math.floor(num/1000000))+" million "+convert_thousands(num%1000000);
    }
    else {
        return convert_thousands(num);
    }
}

function convert_thousands(num){
    if (num>=1000){
        return convert_hundreds(Math.floor(num/1000))+" thousand "+convert_hundreds(num%1000);
    }
    else{
        return convert_hundreds(num);
    }
}

function convert_hundreds(num){
    if (num>99){
        return ones[Math.floor(num/100)]+" hundred "+convert_tens(num%100);
    }
    else{
        return convert_tens(num);
    }
}

function convert_tens(num){
    if (num<10) return ones[num];
    else if (num>=10 && num<20) return teens[num-10];
    else{
        return tens[Math.floor(num/10)]+" "+ones[num%10];
    }
}

function convertNumberToWords(num){
    if (num==0) return "zero";
    else return convert_millions(num);
}


//=================================================================
//===== Accent removal data =======================================
//=================================================================

/*
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var defaultDiacriticsRemovalMap = [
	{ 'base': 'A', 'letters': '\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F' },
	{ 'base': 'AA', 'letters': '\uA732' },
	{ 'base': 'AE', 'letters': '\u00C6\u01FC\u01E2' },
	{ 'base': 'AO', 'letters': '\uA734' },
	{ 'base': 'AU', 'letters': '\uA736' },
	{ 'base': 'AV', 'letters': '\uA738\uA73A' },
	{ 'base': 'AY', 'letters': '\uA73C' },
	{ 'base': 'B', 'letters': '\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181' },
	{ 'base': 'C', 'letters': '\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E' },
	{ 'base': 'D', 'letters': '\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779' },
	{ 'base': 'DZ', 'letters': '\u01F1\u01C4' },
	{ 'base': 'Dz', 'letters': '\u01F2\u01C5' },
	{ 'base': 'E', 'letters': '\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E' },
	{ 'base': 'F', 'letters': '\u0046\u24BB\uFF26\u1E1E\u0191\uA77B' },
	{ 'base': 'G', 'letters': '\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E' },
	{ 'base': 'H', 'letters': '\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D' },
	{ 'base': 'I', 'letters': '\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197' },
	{ 'base': 'J', 'letters': '\u004A\u24BF\uFF2A\u0134\u0248' },
	{ 'base': 'K', 'letters': '\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2' },
	{ 'base': 'L', 'letters': '\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780' },
	{ 'base': 'LJ', 'letters': '\u01C7' },
	{ 'base': 'Lj', 'letters': '\u01C8' },
	{ 'base': 'M', 'letters': '\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C' },
	{ 'base': 'N', 'letters': '\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4' },
	{ 'base': 'NJ', 'letters': '\u01CA' },
	{ 'base': 'Nj', 'letters': '\u01CB' },
	{ 'base': 'O', 'letters': '\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C' },
	{ 'base': 'OI', 'letters': '\u01A2' },
	{ 'base': 'OO', 'letters': '\uA74E' },
	{ 'base': 'OU', 'letters': '\u0222' },
	{ 'base': 'OE', 'letters': '\u008C\u0152' },
	{ 'base': 'oe', 'letters': '\u009C\u0153' },
	{ 'base': 'P', 'letters': '\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754' },
	{ 'base': 'Q', 'letters': '\u0051\u24C6\uFF31\uA756\uA758\u024A' },
	{ 'base': 'R', 'letters': '\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782' },
	{ 'base': 'S', 'letters': '\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784' },
	{ 'base': 'T', 'letters': '\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786' },
	{ 'base': 'TZ', 'letters': '\uA728' },
	{ 'base': 'U', 'letters': '\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244' },
	{ 'base': 'V', 'letters': '\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245' },
	{ 'base': 'VY', 'letters': '\uA760' },
	{ 'base': 'W', 'letters': '\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72' },
	{ 'base': 'X', 'letters': '\u0058\u24CD\uFF38\u1E8A\u1E8C' },
	{ 'base': 'Y', 'letters': '\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE' },
	{ 'base': 'Z', 'letters': '\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762' },
	{ 'base': 'a', 'letters': '\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250' },
	{ 'base': 'aa', 'letters': '\uA733' },
	{ 'base': 'ae', 'letters': '\u00E6\u01FD\u01E3' },
	{ 'base': 'ao', 'letters': '\uA735' },
	{ 'base': 'au', 'letters': '\uA737' },
	{ 'base': 'av', 'letters': '\uA739\uA73B' },
	{ 'base': 'ay', 'letters': '\uA73D' },
	{ 'base': 'b', 'letters': '\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253' },
	{ 'base': 'c', 'letters': '\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184' },
	{ 'base': 'd', 'letters': '\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A' },
	{ 'base': 'dz', 'letters': '\u01F3\u01C6' },
	{ 'base': 'e', 'letters': '\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD' },
	{ 'base': 'f', 'letters': '\u0066\u24D5\uFF46\u1E1F\u0192\uA77C' },
	{ 'base': 'g', 'letters': '\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F' },
	{ 'base': 'h', 'letters': '\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265' },
	{ 'base': 'hv', 'letters': '\u0195' },
	{ 'base': 'i', 'letters': '\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131' },
	{ 'base': 'j', 'letters': '\u006A\u24D9\uFF4A\u0135\u01F0\u0249' },
	{ 'base': 'k', 'letters': '\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3' },
	{ 'base': 'l', 'letters': '\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747' },
	{ 'base': 'lj', 'letters': '\u01C9' },
	{ 'base': 'm', 'letters': '\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F' },
	{ 'base': 'n', 'letters': '\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5' },
	{ 'base': 'nj', 'letters': '\u01CC' },
	{ 'base': 'o', 'letters': '\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275' },
	{ 'base': 'oi', 'letters': '\u01A3' },
	{ 'base': 'ou', 'letters': '\u0223' },
	{ 'base': 'oo', 'letters': '\uA74F' },
	{ 'base': 'p', 'letters': '\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755' },
	{ 'base': 'q', 'letters': '\u0071\u24E0\uFF51\u024B\uA757\uA759' },
	{ 'base': 'r', 'letters': '\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783' },
	{ 'base': 's', 'letters': '\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B' },
	{ 'base': 't', 'letters': '\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787' },
	{ 'base': 'tz', 'letters': '\uA729' },
	{ 'base': 'u', 'letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289' },
	{ 'base': 'v', 'letters': '\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C' },
	{ 'base': 'vy', 'letters': '\uA761' },
	{ 'base': 'w', 'letters': '\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73' },
	{ 'base': 'x', 'letters': '\u0078\u24E7\uFF58\u1E8B\u1E8D' },
	{ 'base': 'y', 'letters': '\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF' },
	{ 'base': 'z', 'letters': '\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763' }
];

var diacriticsMap = {};
for (var i = 0; i < defaultDiacriticsRemovalMap.length; i++) {
	var letters = defaultDiacriticsRemovalMap[i].letters;
	for (var j = 0; j < letters.length; j++) {
		diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap[i].base;
	}
}

// "what?" version ... http://jsperf.com/diacritics/12
function removeDiacritics(str) {
	return str.replace(/[^\u0000-\u007E]/g, function (a) {
		return diacriticsMap[a] || a;
	});
}    