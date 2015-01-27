//<![CDATA[

//initialize all elements, after dom is loaded
$(document).ready(function () {
	$("#ajaxloader").hide();
	$("#expertensuche").hide();
	$("#sortierung").hide();
	$("div#searchresults").hide();
	$("div#map").hide();
	$("#searchbox").keypress(function(event){
		if(event.keyCode == 13){
		  search(null,null,true);
		}
	});

	$('#expertensuche input[name=type]').click(function(evt){
		if(this.value == "all"){
			$("#cbMap").removeAttr('checked');
			$("#cbExcerpt").removeAttr('checked');
			$("#cbWR").removeAttr('checked');
			$("#cbPP").removeAttr('checked');
			$("#cbAll").prop('checked','true');
		} else {
			if($('#expertensuche input[name=type]:checkbox:checked').size() == 0){
				$("#cbAll").prop('checked','true');
			} else {
				$("#cbAll").removeAttr('checked');
			}
		}
	});

	query=getURLParameter('query');
	if(query!="null" && query.length>2){
		$('#searchbox').val(query);
		search(null,null,true);
	}
});

/* global vars */
var map=null;
var restrict = "";
var searchCount = 0;
var werke=null;
var sparqlendpoint="http://data.uni-muenster.de/istgtest/sparql";
var $limit = 100;
var sparqlresultno=0;
var sort;
var skip = 0;
var results;
var sparqlPrefixes="prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> "+
"PREFIX foaf: <http://xmlns.com/foaf/spec/#> "+
"PREFIX luc: <http://www.ontotext.com/owlim/lucene#> "+
"PREFIX istg: <http://vocab.lodum.de/istg/> "+
"PREFIX dct: <http://purl.org/dc/terms/> "+
"PREFIX dc: <http://purl.org/dc/elements/1.1/> " +
"PREFIX gn: <http://www.geonames.org/ontology#>"+
"PREFIX geo-pos: <http://www.w3.org/2003/01/geo/>"+
"PREFIX skos: <http://www.w3.org/2004/02/skos/core#>"+
"PREFIX dbpedia-prop: <http://dbpedia.org/property/> " +
"PREFIX bibo: <http://purl.org/ontology/bibo/> ";


function toggleItemList(container){
	$("#expertensuche").slideToggle()
};

String.prototype.hashCode = function(){
	var hash = 0;
	if (this.length == 0) return hash;
	for (i = 0; i < this.length; i++) {
		char = this.charCodeAt(i);
		hash = ((hash<<5)-hash)+char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash;
}

String.prototype.startsWith = function(str)
{return (this.match("^"+str)==str)}

String.prototype.endsWith = function(str)
{return (this.match(str+"$")==str)}

function replaceURLWithHTMLLinks(text) {
  var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return text.replace(exp,"<a href='$1'>$1</a>");
}

var reducer = function( result ) {
	if (result.head.vars.length == 0) return undefined;
	var firstvar = result.head.vars[0];
	if (result.results.bindings.length == 0) return null;

	var reduced = {};
	$.each(result.results.bindings, function(index, val) {
		if(val[firstvar]==undefined){
			return true;
		}
		var v = val[firstvar].value;
		if (!(v in reduced)) reduced[v] = {};
		$.each(val, function(variable, binding) {
			if (variable == firstvar)
				return true;
			if (!(variable in reduced[v]))
				reduced[v][variable] = [];
			if (variable == "werkebandnr" || variable == "werketitel") reduced[v][variable].push(binding.value);
			if ($.inArray(binding.value, reduced[v][variable]) == -1) {
				reduced[v][variable].push(binding.value);
			}
		});
	});
	// TODO for debugging only
	//	var x = {}; x.result = result; x.reduced = reduced; $.dump(x);
	return reduced;
};

function getURLParameter(name) {
  return decodeURI(
    (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1]
  );
}

var xhr;
var markerArray;
var titleArray;
var latlongArray;
var markerGroup = new L.LayerGroup();
var markerCluster = new L.MarkerClusterGroup({showCoverageOnHover: false});
markerCluster.on('clusterclick', function(a){
	a.layer.zoomToBounds();
});
var previousSearchTerm="";
var previousSparqlResultNo=0;
var previousSparqlOffset=0;
var overallresultno=0;
var stringSimilarity="~0.9 ";
var reducedjson;
function search($sort,$offset,$fireCount){
	if($offset){
		$(document).scrollTop( $("#searchbox").offset().top );
	}
	$('div#searchresults').slideDown();

	//remove whitespaces in front and at the end
	$searchstring=$.trim($('#searchbox').val());
	var back=false;
	if($searchstring.length>2){
		$('.moresearchresults').remove();
		$("#expertensuche").slideUp();
		$("#suche").removeClass('show').addClass('hide');
		$("#ajaxloader").slideDown();
		$('.searchresult').remove();
		$("#map").hide();
		$("#dateSlider").hide();
		$("#sortierung").hide();
		$("#note").remove();

		//reset the sparqlresultno if there is a "new" search
		if($searchstring!=previousSearchTerm){
			sparqlresultno=0;
			overallresultno=0;
			$sort=null;
			back=false;
		}else{ //if no new searchstring but the search() function is fired
			if($offset == null || $offset == 0) {
				back=false;
				sparqlresultno=0;
				overallresultno=0;
			} else {
				back=true;
			}
		}
		previousSearchTerm=$searchstring;
		var request = { accept : 'application/sparql-results+json' };
		//replace -
		$searchstring=$searchstring.replace("-"," ");
		//ceck if searchstring is embraced in "" -> concat terms with &&
		if($searchstring.startsWith("\"") && $searchstring.endsWith("\"")  ){
			$searchstring = $searchstring.replace('"', "").replace('"', "");
			//split searchterm in single terms
			tokens=$searchstring.split(" ");
			console.log(tokens);
			$wholestring=$searchstring;
			$searchstring="?s luc:istgnewLiteralIndex '";
			$.each(tokens, function(index, value) {
				if(value != "")
				{
					if(index>0){
						$searchstring+=" && "+value;
					}else{
						$searchstring+=value;
					}
				}
			});
			$searchstring+="' .";
		}else if($searchstring.indexOf(" ") != -1){
			//split searchterm in single terms
			tokens=$searchstring.split(" ");
			$wholestring=$searchstring;
			$searchstring="?s luc:istgnewLiteralIndex '";
			$.each(tokens, function(index, value) {
				if(index>0){
					$searchstring+="or "+value+"*"+stringSimilarity;
				}else{
					$searchstring+=value+"*"+stringSimilarity;
				}
			});
			$searchstring+="or "+$wholestring+"*"+stringSimilarity+"'";
			$searchstring+=".";
		}else{
			$searchstring = "?s luc:istgnewLiteralIndex \"*"+$searchstring+"*"+stringSimilarity+"\".";
		}

		//start building sparql string
		//ty="?x ?y ?s.?x rdf:type ?typ.";
		//ty="?x ?y ?s.?x istg:icon ?typ.";
		ty="?x ?y ?s.";

		//add sorting options to query (no sort = sorting by lucene relevance)
		$('#abc').css('font-weight','normal');
		$('#relevance').css('font-weight','normal');
		$('#dateAsc').css('font-weight','normal');
		$('#dateDesc').css('font-weight','normal');
		$sorting=" ";
		$('#sortNote').hide();
		if($sort == undefined){
			if($("#expertensuche input[name=type]:checkbox:checked").size() == 1){
				if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "http://purl.org/ontology/bibo/Map"){
					$sorting="DESC(?weight) ASC(str(?title)) ";
					$('#abc').css('font-weight','bold');
				} else if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "http://vocab.lodum.de/istg/PicturePostcard") {
					$sorting="DESC(?weight) ASC(str(?title)) ";
					$('#abc').css('font-weight','bold');
				} else if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "http://vocab.lodum.de/istg/WrittenResource") {
					$sorting="DESC(?weight) DESC(?issued) ";
					$('#dateDesc').css('font-weight','bold');
					$('#sortNote').show();
					// $('#sortierung').after('<p id="note">"Bei dieser Sortierung der Ergebnisse werden die Kriterien "Relevanz" und "Erscheinungsjahr" kombiniert, damit die wichtigsten und die aktuellsten/ältesten Treffer zuerst angezeigt werden. Dabei kann es zugunsten der Listung des Suchbegriffs im Titel zu Verschiebungen in der chronologischen Reihenfolge kommen."</p>');
				} else if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "http://purl.org/ontology/bibo/Excerpt") {
					$sorting="DESC(?weight) ASC(str(?title)) ";
					$('#abc').css('font-weight','bold');
				} else if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "all") {
					$sorting="DESC(?weight)";
					$('#relevance').css('font-weight','bold');
				}
			} else {
				$sorting="DESC(?weight)";
			}
		} else {
			if($sort=="relevanz"){
				$sorting="DESC(?weight)";
				$('#relevance').css('font-weight','bold');
			}else if($sort=="date_desc"){
				//ty+="?x dct:issued ?issued.";
				$sorting="DESC(?weight) DESC(?issued) ";
				$('#dateDesc').css('font-weight','bold');
				$('#sortNote').show();
				// $('#sortierung').after('<p id="note">"Bei dieser Sortierung der Ergebnisse werden die Kriterien "Relevanz" und "Erscheinungsjahr" kombiniert, damit die wichtigsten und die aktuellsten/ältesten Treffer zuerst angezeigt werden. Dabei kann es zugunsten der Listung des Suchbegriffs im Titel zu Verschiebungen in der chronologischen Reihenfolge kommen."</p>');
		 	}else if($sort=="date_asc"){
				//ty+="?x dct:issued ?issued.";
				$sorting="DESC(?weight) ASC(?issued) ";
				$('#dateAsc').css('font-weight','bold');
				$('#sortNote').show();
				// $('#sortierung').after('<p id="note">"Bei dieser Sortierung der Ergebnisse werden die Kriterien "Relevanz" und "Erscheinungsjahr" kombiniert, damit die wichtigsten und die aktuellsten/ältesten Treffer zuerst angezeigt werden. Dabei kann es zugunsten der Listung des Suchbegriffs im Titel zu Verschiebungen in der chronologischen Reihenfolge kommen."</p>');
			}else if($sort=="abc"){
				$sorting="DESC(?weight) ASC(str(?title)) ";
				$('#abc').css('font-weight','bold');
			}
		}

		off="";
		if($offset!=null){
			var currentOffset = parseInt($offset,10);

			if(currentOffset == 0){
				off = "";
			} else {
				//currentOffset++;
				off=" OFFSET "+currentOffset;
			}
			//off=" OFFSET "+$offset+1;
		}
		//ty+="FILTER(!EXISTS{?x rdf:type foaf:Person} && !EXISTS{?x istg:publishingLocation ?s} && !EXISTS{?x foaf:name ?s} && !EXISTS{?x gn:name ?s} &&  !EXISTS{?x bibo:owner ?s}). ";

		var displaySearchRestriction="";

		//NEW add type restrictions to sparql query
		var typeRestriction = "FILTER(";
		var typeRestriction2 = "FILTER(";
		if($('#expertensuche input[name=type]:checkbox:checked').size() == 1 ){
			if($('#expertensuche input[name=type]:checkbox:checked')[0].value!="all"){
				typeRestriction+="EXISTS{?x rdf:type <"+$('#expertensuche input[name=type]:checkbox:checked')[0].value+">}).";
				typeRestriction2+="EXISTS{?werke rdf:type <"+$('#expertensuche input[name=type]:checkbox:checked')[0].value+">}).";
				displaySearchRestriction+=$('#expertensuche input[name=type]:checkbox:checked')[0].parentElement.textContent.trim();
			} else {
				typeRestriction="";
				typeRestriction2 = "";
			}
		} else {
			checkedTypes = $('#expertensuche input[name=type]:checkbox:checked');
			$.each(checkedTypes, function(index, value){
				typeRestriction+="EXISTS{?x rdf:type <"+checkedTypes[index].value+">} ||";
				typeRestriction2+="EXISTS{?werke rdf:type <"+checkedTypes[index].value+">} ||";
				displaySearchRestriction+=value.parentElement.textContent.trim()+",";
			});
			if(displaySearchRestriction.endsWith(",")){
     	  displaySearchRestriction=displaySearchRestriction.substr(0,displaySearchRestriction.length-1);
    	}
			n = typeRestriction.lastIndexOf(" ||");
			typeRestriction =typeRestriction.substring(0, n);
			n = typeRestriction2.lastIndexOf(" ||");
			typeRestriction2 =typeRestriction2.substring(0, n);
			typeRestriction+=")."
			typeRestriction2+=")."
		}

		restrict = "";
		//NEW add property restrictions to sparql query
		if($('#expertensuche input[name=property]:checkbox:checked').size()>0){
			checks=$('#expertensuche input[name=property]:checkbox:checked');
			if(displaySearchRestriction!="") displaySearchRestriction+=" | ";
			$.each(checks, function(index, value) {
				displaySearchRestriction+=value.parentElement.textContent.trim()+",";
			});
			//remove last
			//var  restrict = "";
			if(checks.length != 1){
				restrict+="FILTER(";
				for (var i=0;i<checks.length;i++){
					attributes=$('#expertensuche input[name=property]:checkbox:checked')[i].value.split(',');
					for (var j=0;j<attributes.length;j++){
						restrict+="EXISTS{?x <"+attributes[j]+"> ?s.} || "
					}
				}
				n = restrict.lastIndexOf(" ||");
				restrict = restrict.substring(0, n);
				restrict+=")."
				displaySearchRestriction+="";
			} else {
				attributes=$('#expertensuche input[name=property]:checkbox:checked')[0].value.split(',');
				if(attributes.length>1){
					restrict+="FILTER(";
					for (var j=0;j<attributes.length;j++){
						restrict+="EXISTS{?x <"+attributes[j]+"> ?s.} || "
					}
					n = restrict.lastIndexOf(" ||");
					restrict = restrict.substring(0, n);
					restrict+=").";
					displaySearchRestriction+="";
				} else {
					restrict+="FILTER( EXISTS{?x <"+attributes[0]+"> ?s.}).";
				}
			}
		}

		if($('#expertensuche :text')!=undefined && $('#expertensuche :text')[0].value!="" && $('#expertensuche :text')[0].value.length==4){
			ty+="{?x dct:issued ?is.FILTER(regex(str(?is),'"+$('#expertensuche :text')[0].value+"'))}.";
			displaySearchRestriction+=$('#expertensuche :text')[0].parentElement.textContent.trim()+",";

		}

		if(displaySearchRestriction.endsWith(",")){
			displaySearchRestriction=displaySearchRestriction.substr(0,displaySearchRestriction.length-1);
		}


		if(displaySearchRestriction!=""){
			$("#searchRestrictions").html("(Momentan: "+displaySearchRestriction+" )");
		}else{
			$("#searchRestrictions").html("");
		}

		//Query
		query = 'dct\\:title:"'+$.trim($('#searchbox').val())+'"~0.9';

		//FILTER
		fq = "";
		checkedTypes = $('#expertensuche input[name=type]:checkbox:checked');
		$.each(checkedTypes, function(index, value){
			if (checkedTypes[index].value !== 'all') {
				if (fq === "") {
					fq += 'rdf\\:type:(';
					fq += '"'+checkedTypes[index].value+'"';
				} else {
					fq += ' OR "'+checkedTypes[index].value + '"';
				}
			} else {
				//filter out persons
				fq += 'rdf\\:type:(-"http://xmlns.com/foaf/spec/#Person"';
			}
		});
		if (fq !== "") {
			fq += ')';
		}

		//Sort
		sort = 'dct\:title asc';

		//Start & rows
		start = ($offset !== null ? $offset : 0);
		rows = 100;

		//Build URL
		url = "http://gin-isdg.uni-muenster.de:8983/solr/collection1/select?q=" + encodeURIComponent(query) + "&fq=" + encodeURIComponent(fq) + "&sort=" + encodeURIComponent(sort) + "&start="+start+"&rows="+rows+"&wt=json&indent=true&json.wrf=?";
		$.getJSON(url)
			.done( function ( data ) {
				$('.error').remove();
				$('.searchresult').remove();
				$("#ajaxloader").hide();
				$("#suche").removeClass('hide').addClass('show');
				totalResults = data.response.numFound;
				$("#searchResultCount").text("Suchergebnisse ("+totalResults+")");
				$("#sortierung").slideDown();
				results = data.response.docs;
				lastTwoDigits = parseInt(totalResults.toString().slice(-2));
				skip = totalResults - lastTwoDigits;
				next = (results.length < 100 ? results.length : 100);

				//only show pagination if totalresults is bigger than 100
				if (totalResults > 100) {
					(back) ? backHTML="<a disabled="+'"<%= bit>"'+" href=\"javascript:search('"+sort+"',0,false)\"><<&nbsp;</a><a disabled="+'"<%= bit>"'+" href=\"javascript:search('"+sort+"',"+(start-100)+",false)\">< vorherige Ergebnisse</a> |"+(start+1)+"-"+(start+next)+"| " : backHTML="|1-"+rows+"|";
					forwardHTML = (next == 100 ? "<a href=\"javascript:search('"+sort+"',"+(start+100)+",false)\">weitere Ergebnisse ></a><a href=\"javascript:search('"+sort+"',"+skip+",false)\"> >></a>" : "");
					moreresults="<span style=\"float:left;\" class=\"moresearchresults\"> "+backHTML+" "+forwardHTML+" </span>";
					$("#searchresults").prepend(moreresults);
				}

				$.each(results, function (index,value) {
					title = (results[index]["dct:title"] !== undefined ? results[index]["dct:title"] : "unknown");
					subtitle = (results[index]["istg:subtitle"] !== undefined ? results[index]["istg:subtitle"] : "");

					$("#searchresults").append("<div style=\"float:left; border:1px solid #cac9d0;padding:1em;min-height:70px;margin-top:20px;\" class='searchresult' id='result_"+index+"_outer' >"
					+"<div class=\"title\" id='result_"+index+"'><div style=\"width:50px;height:32px;float:left;text-align:center;font-size:9px;\"><div class=\"count\">"+(index+1+start)+". </div><div class=\"icon\">"+getIcon(results[index]["rdf:type"], results[index]["istg:type"])+"</div></div>"
					+"<div style=\"padding-left:90px;\"><a  href=\"javascript:showProperties('"+results[index].id+"','"+index+"','true')\"><span class=\"stringresult\">" + title + "</span></a>"
					+"</span><br/><span style=\"font-size:9px;\">"+ subtitle +"</span></div></div><div class=\"properties\" id=\"properties_"+index+"\" style=\"float:left;\" ></div></div>");
				});
			})
			.fail( function ( jqxhr, textStatus, error) {
				console.log("Request failed: " + textStatus +", " + error);
			});

		// xhr = $.ajax({
		// 	beforeSend: function(xhrObj){
		// 		xhrObj.setRequestHeader("Accept","application/sparql-results+json");
		// 	},
		// 	url: sparqlendpoint,
		// 	type: "POST",
		// 	dataType: "json",
		// 	data: request,
		// 	timeout:90000,
		// 	complete: function(jqXHR,status){
		// 		if(status=="timeout"){
		// 			$('.searchresult').remove();
		// 			$('.error').remove();
		// 			$("#ajaxloader").hide();
		// 			$("#suche").removeClass('hide').addClass('show');
		// 			if($sort != undefined){
		// 				$("#searchresults").append("<div class='error'>Störung! Bitte versuchen Sie es später noch einmal!</div>");
		// 				//$("#searchresults").append("<div class='error'>Ihre Treffermenge ist leider zu groß für eine Umsortierung!</div>");
		// 			}else{
		// 				$("#map").hide();
		// 				$("#searchresults").append("<div class='error'>Störung! Bitte versuchen Sie es später noch einmal!</div>");
		// 				//$("#searchresults").append("<div class='error'>Die Anfrage dauert zu lange, da stimmt etwas nicht ! Bitte variieren oder spezifizieren Sie Ihre Suchworte und lockern Sie ggf. die Einschränkungen in der <span onclick=\"javascript:toggleItemList('#expertensuche');\" style=\"cursor: pointer;padding-top:0.5em;\">\"&raquo;Expertensuche\".</span>!</div>");
		// 			}
		// 		}
		// 	},
		// 	success: function(json, status, jqXHR){
		// 		if(status=="success"){
		// 			$('.error').remove();
		// 			$('.searchresult').remove();
		// 			$("#ajaxloader").hide();
		// 			$("#suche").removeClass('hide').addClass('show');
		// 			console.log("JSON Results");
		// 			console.log(json);
		// 			if(json.results.bindings.length>0){
		// 				$("#sortierung").slideDown();
		// 				//create new marker array
		// 				markerArray = {};
		// 				titleArray = {};
		// 				latlongArray =new Array();
		// 				//reduce sparql result
		// 				previousSparqlResultNo=sparqlresultno;
		// 				sparqlresultno+=json.results.bindings.length;
		// 				json=reducer(json);
		// 				//count = countProperties(json);
		// 				console.log("Reduced JSON");
		// 				console.log(json);
		// 				reducedjson = json;
		// 				//sparqlresultno += Object.keys(json).length;
		// 				console.log("SparqlResultNo");
		// 				console.log(sparqlresultno);
		// 				//$("#searchResultCount").text("Suchergebnisse ("+countProperties(json)+")");
		// 				currentresultno=0;
		// 				var j=0;
		// 				searchCount = 0;
		// 				werke = null;
		// 				$.each(json, function(i){
		// 					werke = null;
		// 					j++;
		// 					overallresultno++;
		// 					currentresultno++;
		// 					title="no title";
		// 					if( json[i].title!= undefined){
		// 						title=json[i].title[0];
		// 					}else if( json[i].title1 != undefined){
		// 						title=json[i].title1[0];
		// 					}
		// 					subtitle="";
		// 					if(json[i].title1 != undefined){
		// 						subtitle=json[i].title1;
		// 					}

		// 					//create array for marker
		// 					if($("#expertensuche input[name=type]:checkbox:checked").size() == 1){
  //               if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "http://purl.org/ontology/bibo/Excerpt"){
		// 							markerArray[i]= json[i].longlat;
		// 						}
		// 					}
		// 					titleArray[i]=title;

		// 					//Select Icon for the type
		// 					figure = "<figure><img src=\"http://data.uni-muenster.de/istg/document.png\" alt=\"Unbekannter Dokumenttyp\"></figure>";

		// 					if( json[i].typ != undefined){
		// 						if(json[i].comment && json[i].comment[0].search("Elektronische Ressource")!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/CD-ROM.png\" alt=\"CD-ROM\"><figcaption>Disc</figcaption></figure>";
		// 						}else if($.inArray("Bandaufführung",json[i].type)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Bandauffuehrung\"><figcaption>Einzel-<br />band</figcaption</figure>";
		// 						}else if($.inArray("Q", json[i].type)!=-1) {
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Monographie\"><figcaption>Buch</figcaption</figure>";
		// 						}else if($.inArray("Zeitschriftenband",json[i].type)!=-1) {
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Zeitschriftenband.png\" alt=\"Zeitschriftenband\"><figcaption>Zeit-<br />schriften-<br />band</figcaption</figure>";
		// 						}else if($.inArray("Zeitschrift", json[i].type)!=-1) {
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Zeitschrift.png\" alt=\"Zeitschrift\" ><figcaption>Zeitschrift</figcaption</figure>";
		// 						}else if( $.inArray("http://purl.org/ontology/bibo/Book", json[i].typ)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Monographie\"><figcaption>Buch</figcaption</figure>";
		// 						}else if($.inArray("http://purl.org/ontology/bibo/Map", json[i].typ)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height32px;\" src=\"http://data.uni-muenster.de/istg/images/Karten.png\" alt=\"Karte\"><figcaption>Karte</figcaption</figure>";
		// 						}else if($.inArray("http://purl.org/ontology/bibo/Periodical", json[i].typ)!=-1 || $.inArray("http://purl.org/ontology/bibo/MultiVolumeBook", json[i].typ)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/mehrbaendiges%20Werk.png\" alt=\"mehrbaendiges Werk\"><figcaption>mehr-<br />bändiges Werk</figcaption</figure>";
		// 						}else if( $.inArray("http://vocab.lodum.de/istg/PicturePostcard", json[i].typ)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Ansichtskarten_2.png\" alt=\"Ansichtskarte\"><figcaption>Ansichts-<br />karte</figcaption</figure>";
		// 						}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].typ)!=-1){
		// 							figure = "<figure><img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\"><figcaption></figcaption</figure>";
		// 						}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].typ)!=-1){
		// 							figure = "<figure><img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\"><figcaption></figcaption</figure>";
		// 						}else if( $.inArray("http://purl.org/ontology/bibo/Excerpt", json[i].typ)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Stadtinformationen.png\" alt=\"Stadtinformation\"><figcaption>Stadt-<br />information</figcaption</figure>";
		// 						}else if( $.inArray("http://purl.org/ontology/bibo/Article", json[i].typ)!=-1){
		// 							figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Aufsatz.png\" alt=\"Aufsatz\"><figcaption>Aufsatz</figcaption</figure>";
		// 						}else if($.inArray("http://xmlns.com/foaf/spec/#Person", json[i].typ)!=-1){
		// 							werke = json[i].werke;
		// 							if(json[i].comment && json[i].comment[0].search("Elektronische Ressource")!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/CD-ROM.png\" alt=\"CD-ROM\"><figcaption>Disc</figcaption</figure>";
		// 							}else if($.inArray("Bandaufführung",json[i].type)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Bandauffuehrung\"><figcaption>Einzel-<br />band</figcaption</figure>";
		// 							}else if($.inArray("Q", json[i].type)!=-1) {
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Monographie\"><figcaption>Q</figcaption</figure>";
		// 							}else if($.inArray("Zeitschriftenband",json[i].type)!=-1) {
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Zeitschriftenband.png\" alt=\"Zeitschriftenband\"><figcaption>Zeit-<br />schriften-<br />band</figcaption</figure>";
		// 							}else if($.inArray("Zeitschrift", json[i].type)!=-1) {
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Zeitschrift.png\" alt=\"Zeitschrift\" ><figcaption>Zeitschrift</figcaption</figure>";
		// 							}else if( $.inArray("http://purl.org/ontology/bibo/Book", json[i].werketyp)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Monographie\"><figcaption>Buch</figcaption</figure>";
  //               	}else if($.inArray("http://purl.org/ontology/bibo/Map", json[i].werketyp)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Karten.png\" alt=\"Karte\"><figcaption>Karte</figcaption</figure>";
  //               	}else if($.inArray("http://purl.org/ontology/bibo/Periodical", json[i].werketyp)!=-1 || $.inArray("http://purl.org/ontology/bibo/MultiVolumeBook", json[i].typ)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/mehrbaendiges%20Werk.png\" alt=\"mehrbaendiges Werk\"><figcaption>mehr-<br />bändiges Werk</figcaption</figure>";
  //                 }else if( $.inArray("http://vocab.lodum.de/istg/PicturePostcard", json[i].werketyp)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Ansichtskarten_2.png\" alt=\"Ansichtskarte\"><figcaption>Ansichts-<br />karte</figcaption</figure>";
  //               	}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].werketyp)!=-1){
  //                   figure = "<figure><img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\"><figcaption></figcaption</figure>";
  //               	}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].werketyp)!=-1){
  //                   figure = "<figure><img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\"><figcaption></figcaption</figure>";
  //               	}else if( $.inArray("http://purl.org/ontology/bibo/Excerpt", json[i].typ)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Stadtinformationen.png\" alt=\"Stadtinformation\"><figcaption>Stadt-&nbspinformation</figcaption</figure>";
		// 							}else if( $.inArray("http://purl.org/ontology/bibo/Article", json[i].typ)!=-1){
		// 								figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Aufsatz.png\" alt=\"Aufsatz\"><figcaption>Aufsatz</figcaption</figure>";
		// 							}
		// 						}
		// 					}

		// 					if(json[i].werke != undefined){
		// 						werke = json[i].werke;
		// 					}

		// 					//Build HTML for results
		// 					if(werke != undefined){
		// 						$.each(werke,function(index){
		// 							searchCount++;
		// 							var werk = werke[index];
		// 							$("#searchresults").append("<div style=\"float:left; border:1px solid #cac9d0;padding:1em;min-height:70px;margin-top:20px;\" class='searchresult' id='result_"+j+"_outer' >"
		// 							+"<div class=\"title\" id='result_"+i+"'><div style=\"width:50px;height:32px;float:left;text-align:center;font-size:9px;\"><div class=\"count\">"+($offset+j)+". </div><div class=\"icon\">"+figure+"</div></div>"
		// 							+"<a name=\""+werk.hashCode()+"\"></a><div style=\"padding-left:90px;\"><a  href=\"javascript:showProperties('"+werke[index]+"','"+j+"','true')\"><span class=\"stringresult\">" + title+ "</span></a>"
		// 							+"</span><br/><span style=\"font-size:9px;\">"+subtitle+"</span></div></div><div class=\"properties\" id=\"properties_"+j+"\" style=\"float:left;\" ></div></div>");
		// 						});
		// 					} else {
		// 						searchCount++;
		// 						$("#searchresults").append("<div style=\"float:left; border:1px solid #cac9d0;padding:1em;min-height:70px;margin-top:20px;\" class='searchresult' id='result_"+j+"_outer' >"
		// 						+"<div class=\"title\" id='result_"+i+"'><div style=\"width:50px;height:32px;float:left;text-align:center;font-size:9px;\"><div class=\"count\">"+($offset+j)+". </div><div class=\"icon\">"+figure+"</div></div>"
		// 						+"<a name=\""+i.hashCode()+"\"></a><div style=\"padding-left:90px;\"><a href=\"javascript:showProperties('"+i+"','"+j+"','true')\"><span class=\"stringresult\">" + title+ "</span></a>"
		// 						+"</span><br/><span style=\"font-size:9px;\">"+subtitle+"</span></div></div><div class=\"properties\" id=\"properties_"+j+"\" style=\"float:left;\" ></div></div>");
		// 					}
		// 				}) //end each json

		// 				if($offset != null && $offset != "" && $offset != 0){
		// 					previousSparqlOffset=$offset;
		// 					overallresultno=$offset+100;
		// 					$further=$offset+$limit;
		// 					if ($further > skip) {
		// 						overallresultno=$offset+currentresultno;
		// 					};
		// 					currentresultno=$offset;
		// 				}else{
		// 					$further=$limit;
		// 				}

		// 				if(skip >= overallresultno) {
		// 					if($sort==undefined){
		// 						sort = null
		// 					} else {
		// 						sort = "'"+$sort+"'";
		// 					}
		// 					(back) ? backHTML="<a disabled="+'"<%= bit>"'+" href=\"javascript:search("+sort+",0,false)\"><<&nbsp;</a><a disabled="+'"<%= bit>"'+" href=\"javascript:resultsBack("+sort+")\">< vorherige Ergebnisse</a> |"+currentresultno+"-"+overallresultno+"| " : backHTML="|1-"+overallresultno+"|";
		// 					moreresults="<span style=\"float:left;\" class=\"moresearchresults\"> "+backHTML+" <a href=\"javascript:search("+sort+","+$further+",false)\">weitere Ergebnisse ></a><a href=\"javascript:search("+sort+","+skip+",false)\"> >></a></span>";
		// 					$("#searchresults").prepend(moreresults);
		// 					moreresults="<span style=\"float:left;margin-bottom:60px;\" class=\"moresearchresults\"> "+backHTML+" <a href=\"javascript:search("+sort+","+$further+",false)\">weitere Ergebnisse ></a><a href=\"javascript:search("+sort+","+skip+",false)\"> >></a></span>";
		// 					$("#searchresults").append(moreresults);
		// 				} else {
		// 					(back) ? backHTML="<a style=\"float:left;\" href=\"javascript:search("+sort+",0,false)\"><<&nbsp;</a><a style=\"float:left;\" href=\"javascript:resultsBack("+sort+")\"> < vorherige Ergebnisse</a> |"+currentresultno+"-"+overallresultno+"| " : backHTML="";
		// 					moreresults="<span class=\"moresearchresults\">"+backHTML;
		// 					$("#searchresults").prepend(moreresults);
		// 				}
		// 			}else{
		// 				$("#map").hide();
		// 				$("#searchresults").append("<div class='error'>Diese Anfrage lieferte keinen Treffer! Bitte prüfen Sie die Schreibweise und versuchen Sie es erneut!</div>");
		// 			}

		// 			//highlight searchterms
		// 			keywords=$.trim($("#searchbox").val()).split(" ");
		// 			$.each(keywords, function(key,value){
		// 				highlightKeywords(value);
		// 			});

		// 			if(!$.isEmptyObject( markerArray )){
		// 				$("#map").show();
		// 				//check if map has already been init
		// 				if(map==null){
		// 					map = new L.Map('map');
		// 					L.tileLayer('https://{s}.tiles.mapbox.com/v3/{id}/{z}/{x}/{y}.png',{
		// 						maxZoom: 18,
		// 						attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
		// 							'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
		// 							'Imagery © <a href="http://mapbox.com">Mapbox</a>',
		// 						id: 'examples.map-i86nkdio'
		// 					}).addTo(map);
		// 					//var cloudmade = new L.TileLayer('http://{s}.tile.cloudmade.com/9aed1b5fb54f46c4b2054776a0b080aa/997/256/{z}/{x}/{y}.png', {
		// 					//    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
		// 					//    maxZoom: 18
		// 					//});
		// 					var ms = new L.LatLng( 49.919, 9.8);
		// 					//map.addLayer(basemap);
		// 				}
		// 				map.invalidateSize();

		// 				//new L.Util.requestAnimFrame(map.invalidateSize,map,!1,map._container);
		// 				//markerGroup.clearLayers();
		// 				markerCluster.clearLayers();
		// 				$.each(markerArray, function(i){
		// 					ll=markerArray[i];
		// 					$.each(ll, function(u){
		// 						longlat=ll[u].split(",");
		// 						latln=new L.LatLng(longlat[1],longlat[0]);
		// 						latlongArray.push(latln)
		// 						var marker = new L.Marker(latln);
		// 						marker.bindPopup("<a href=\"#"+i.hashCode()+"\">"+titleArray[i]+"</a>");
		// 						//markerGroup.addLayer(marker);
		// 						markerCluster.addLayer(marker);
		// 					});
		// 				});
		// 				//map.addLayer(markerGroup);
		// 				map.addLayer(markerCluster);
		// 				map.fitBounds(new L.LatLngBounds(latlongArray));
		// 				if(map.getZoom()>15){
		// 					map.setZoom(12);
		// 				}

		// 				$("#searchresults .searchresult:last").css("margin-bottom","60px");
		// 			} //end if check emptyObject

		// 		}
		// 	}
		// }); //end xhr object

	}//end if check for searchterm length

}//end function load Results

var searchresults;

var popUp;
var lastVisitedLinks = [];
function showPartOfDetails(uri,invokedBy){

	if(popUp!=undefined){
		popUp.close()
	}

	div=$("<div id=\"popup\"></div>");
	loadAndAppendPropertiesToElement(uri,'',div);

	if(invokedBy != "back"){
		lastVisitedLinks.push(uri);
	} else {
		lastVisitedLinks.pop();
	}

	if(lastVisitedLinks.length > 1){
		$("#backBtn").removeClass("hidden");
	} else {
		$("#backBtn").addClass("hidden");
	}

	$("#dialog").empty().append(div).dialog("open");
}

$(function() {
	var backBtn = '<button id="backBtn" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-icon-only ui-dialog-titlebar-close hidden" role="button" aria-disabled="false" title="back" style="left: .3em;"><span class="ui-button-icon-primary ui-icon ui-icon-arrowthick-1-w"></span><span class="ui-button-text">back</span></button>';
    $( "#dialog" ).dialog({
      autoOpen: false,
			create:  function() {
				$(this).prev('.ui-dialog-titlebar').append(backBtn);
			},
      close: function(event, ui) {
				$(this).empty();
				lastVisitedLinks = [];
				$(this).dialog('close');
      }
    });
		$("#backBtn")
			.hover(function(){
				$(this).addClass("ui-state-hover");
			},function(){
				$(this).removeClass("ui-state-hover");
			})
			.click(function(){
				console.log("lastvisitedlink");
				console.log(lastVisitedLinks.length-1);
				showPartOfDetails(lastVisitedLinks[lastVisitedLinks.length-2],"back");
			});
		$(".ui-dialog").appendTo("#istg_main_wrapper").zIndex(1001);
 });

/**
 * Filters out Solr specific and not used
 * vocab fields
 * @param  {Array} entries solr response
 * @return {Array}         filtered array
 */
function filterSolrFields (entries) {
	var tempArr = [];
	for (entry in entries) {
		if ((entry.indexOf(":") > -1 || entry === "id") && entry.indexOf("_") === -1 && entry !== "rdf:type" && entry !== "dct:modified") {
			tempArr.push([entry, entries[entry]]);
		}
	}
	return tempArr;
}

/**
 * Gets nested URLs for an entry
 * @param  {Array} array array to search for nested URLs
 * @return {Array}       array containing nested URLs
 */
function getNestedURLs (array) {
	var tempArr = [];
	for(entry in array) {
		if (array[entry][1] instanceof Array) {
			$.each(array[entry][1], function (index, value) {
				if (value.indexOf("http://") > -1) {
					tempArr.push([array[entry][0],value]);
				}
			});
		}
	}
	return tempArr;
}

/**
 * Loads data for Popup window
 * @param  {String} id      Resource id to load
 * @param  {String} element DOM element
 */
function loadNestedData (id,element) {
	var ids = [];
	ids.push(id);

	var resultArr = [];
	ids.reduce(function(prev, cur, index) {
    return prev.then(function(data) {
      query = 'id:"'+cur+'" OR dct\\:isPartOf:"'+cur+'"';
			url = "http://gin-isdg.uni-muenster.de:8983/solr/collection1/select?q=" + encodeURIComponent(query) + "&wt=json&indent=true&json.wrf=?";
			return $.ajax({
				dataType: "json",
				url: url
			}).then(function (data) {
				resultArr.push(data.response.docs[0]);
			})
  	})
	}, $().promise()).done(function() {
		resultArr = filterSolrFields(resultArr[0]);
    urls = getNestedURLs(resultArr);
		resultArr = sortResults(resultArr);
		urls.push(['contains',resultArr[0][1]]);
		appendTo(urls,resultArr,element);
	});
}

/**
 * Sort the results accordingly to defined
 * order in labels.js
 * @param  {Array} resultArr array to sort
 * @return {Array}           sorted array
 */
function sortResults (resultArr) {
	resultArr.sort(function(a,b){

		sortA = $.grep(displaySort, function (e) {
			return e.property == a[0];
		});
		sortB = $.grep(displaySort, function (e) {
			return e.property == b[0];
		});

		if (sortA.length > 0 && a[3] === undefined && a[4] === undefined) {
			a.push(sortA[0].label);
			a.push(sortA[0].sort);
		} else if (sortA.length === 0) {
			a.push(undefined);
			a.push(-1);
		}
		if (sortB.length > 0 && b[3] === undefined && b[4] === undefined) {
			b.push(sortB[0].label);
			b.push(sortB[0].sort);
		} else if (sortB.length === 0) {
			b.push(undefined);
			b.push(-1);
		}

		return a[3]-b[3];
	});

	return resultArr;
}

/**
 * Appends data to its final DOM element
 * @param  {Array} urls      Array with nested URLs
 * @param  {Array} resultArr Array that holds the results
 * @param  {String} element   DOM element
 */
function appendTo(urls,resultArr,element) {
	var properties='<table id=\"proptable\" align=\"left\" style=\"font-size:10px;text-align:left;\">';
	urls.reduce(function(prev, cur, index) {
    return prev.then(function(data) {
	    query = 'id:"'+cur[1]+'" OR dct\\:isPartOf:"'+cur[1]+'"';
			url = "http://gin-isdg.uni-muenster.de:8983/solr/collection1/select?q=" + encodeURIComponent(query) + "&wt=json&indent=true&json.wrf=?";
			return $.ajax({
	  		dataType: "json",
	  		url: url
			}).then(function(data){

				if (data.response.docs.length > 1) {
					$.each(resultArr, function (index, value) {
						if (resultArr[index][0] === "dct:isPartOf" && resultArr[index+1] !== undefined && resultArr[index+1][0] !== "contains") {
							resultArr.splice(index+1,0,['contains',[],'enthält']);
						}
					});
				}

				$.each(resultArr, function (index,value) {
					if (resultArr[index][0] === cur[0]) {
						if (cur[0] === "dc:creator") {
							$.each(resultArr[index][1], function (ind,value) {
								if (value === cur[1]) {
									resultArr[index][1][ind] = [cur[1],data.response.docs[0]["foaf:name"][0]];
								}
							});
						} else if (cur[0] === "dct:isPartOf") {
							$.each(resultArr[index][1], function (ind,value) {
								if (value === cur[1]) {
									resultArr[index][1][ind] = [cur[1],data.response.docs[0]["dct:title"]];
								}
							});
						} else if (cur[0] === "bibo:editor") {
							$.each(resultArr[index][1], function (ind,value) {
								if (value === cur[1]) {
									resultArr[index][1][ind] = [cur[1],data.response.docs[0]["foaf:name"][0]];
								}
							});
						} else if (cur[0] === "dct:contributor") {
							$.each(resultArr[index][1], function (ind,value) {
								if (value === cur[1]) {
									resultArr[index][1][ind] = [cur[1],data.response.docs[0]["foaf:name"][0]];
								}
							});
						} else if (cur[0] === "contains") {
							$.each(data.response.docs, function (ind, value) {
								if ($.inArray(resultArr[0][1],data.response.docs[ind]["dct:isPartOf"]) > -1) {
									id = data.response.docs[ind].id;
									title = data.response.docs[ind]["dct:title"];
									contain = [id,title];
									resultArr[index][1].push(contain);
								}
							});
						}
					}
				});
			});
    })
	}, $().promise()).done(function() {
		//everything is set up to display
		$.each(resultArr,function (index, value) {
			if (value[2]) {
				if (value[1] instanceof Array) {
					label = value[2];
					content = "";
					if (value[0] == "dc:creator") {
						$.each(value[1], function (index, value) {
							if (content !== "") {
								content += "<br>";
							}
							content += value[1];
						});
					} else if (value[0] === "dct:isPartOf") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += "<br>";
							}
							if (value[0].indexOf("http://") > -1) {
								content += "<a href=\"javascript:showPartOfDetails('"+value[0]+"');\">"+value[1]+"</a>";
							} else {
								content += value;
							}
						});
					} else if (value[0] === "contains") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += "<br>";
							}
							if (value[0].indexOf("http://") > -1) {
								content += "<a href=\"javascript:showPartOfDetails('"+value[0]+"');\">"+value[1]+"</a>";
							} else {
								content += value;
							}
						});
					} else if (value[0] === "dct:publisher") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += "<br>";
							}
							if (value.indexOf("http://") > -1) {
								content += "<a href=\"javascript:showPartOfDetails('"+value[0]+"');\">"+value[1]+"</a>";
							} else {
								content += value;
							}
						});
					} else if (value[0] === "dc:subject") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += "<br>";
							}
							content += value;
						});
					} else if (value[0] === "bibo:editor") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += "<br>";
							}
							content += value[1];
						});
					} else if (value[0] === "dct:contributor") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += "<br>";
							}
							if (value[0].indexOf("http://") > -1) {
								content += value[1];
							} else {
								content += value;
							}
						});
					} else if (value[0] === "dct:issued") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += " - ";
							}
							content += value.substring(0,4);
						});
					} else if (value[0] === "bibo:edition") {
						$.each(value[1], function (index,value) {
							if (content !== "") {
								content += " - ";
							}
							content += value;
						});
					}
				} else {
					label = value[2];
					content = value[1];
					if (value[0] === "rdfs:comment") {
						var newObject = "";
						var split = content.split("\n");
						$.each(split, function(j){
							if(newObject == ""){
								newObject += split[j];
							}else{
								newObject=newObject + "<br>" + split[j];
							}
						});
						content = newObject;
					} else if (value[0] === "istg:type" && content === "Q") {
						content = "Quellen";
					}
				}
				if (content !== "") {
					properties+="<tr><td width=\"150px\" style=\"vertical-align:top;\">"+label+"</td><td><span class=\"stringresult\">"+content+"</span></td></tr>";
				}
			}
		});
		$("#ajaxloader2").remove();
		div=$("<div id=\"properties\" style=\"min-height:320px;float:left; \">"+properties+"</div> ");
		element.append(div).hide();
		element.slideToggle(300);
	});
}

/**
 * Handles all links in the metasearch
 * @param  {String} uri       clicked resource URI
 * @param  {integer} id       index in global results array
 * @param  {String} element   final DOM element
 * @param  {Boolean} highlight highlight searchterm (not supported yet)
 */
function loadAndAppendPropertiesToElement(uri,id,element,highlight){
	if (id !== "") {
		var resultArr = filterSolrFields(results[id]);
		var urls = getNestedURLs(resultArr);
		urls.push(['contains',results[id].id]);
		resultArr = sortResults(resultArr);
		appendTo(urls,resultArr,element);
	} else {
		loadNestedData(uri,element);
	}

	// var request = { accept : 'application/sparql-results+json' };
	// request.query = sparqlPrefixes+"SELECT ?y ?z ?label ?sort ?werke ?werketitel ?werkebandnr ?contributorName ?seriesNumber ?publisherName ?issueName ?signature ?collection ?creatorName ?placeName ?countryName (CONCAT(?cartographerFN, ' ' ,?cartographerLN) AS ?cartographer) ?editorName ?article ?mapType ?histPlaceName ?category ?authorName ?cityName ?regionName ?cityName ?continentName ?technicName ?organizationName ?partOfDesc ?partOf ?partOf2 WHERE {"
	// +"<"+uri+"> ?y ?z.?y <http://www.w3.org/2000/01/rdf-schema#label> ?label."
	// +"OPTIONAL{?y <http://vocab.lodum.de/istg/displaySort> ?sort}."
	// //+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc}."
	// //+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc.?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:issued ?partOfIssued.BIND(CONCAT(?partOfDesc,' (',str(?partOfIssued),')') AS ?partOfDesc)}."
	// //+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc.?partOf dct:issued ?partOfIssued.BIND(CONCAT(?partOfDesc,' (',str(?partOfIssued),')') AS ?partOfDesc)}."
	// /*+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
	// 	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:editorString ?partOfEditorName. BIND(CONCAT(?partOfEditorName,'(Hrsg.):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
	// 	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. BIND(CONCAT(?partOfAuthorName,'(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
	// 	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:editorString ?partOfEditorName. BIND(CONCAT(?partOfEditorName,'(Hrsg.)(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
	// 	//einzelwerk ist teil von aufsatz und aufsatz von gesamtwerk
	// 	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName. BIND(CONCAT(?partOfAuthorName,'(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.)::<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
	// 	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.):<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
	// 	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName.?partPartOf dct:issued ?partPartOfIssued. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.)(',str(?partPartOfIssued),'):<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
	// */
	// //+"OPTIONAL{<"+uri+"> istg:technic ?technic. ?technic foaf:name ?technicName}."
	// //+"OPTIONAL{<"+uri+"> istg:historicalLocation ?histLoc. ?histLoc gn:name ?histLocName}."
	// //+"OPTIONAL{<"+uri+"> bibo:editor ?publisher. ?publisher foaf:name ?editorName}."
	// //+"OPTIONAL{<"+uri+"> istg:cartographer ?cartographer. ?cartographer <http://xmlns.com/foaf/0.1/family_name> ?cartographerName}."
 //  //+"OPTIONAL{<"+uri+"> istg:city ?city. ?city gn:name ?cityName}."
	// //+"OPTIONAL{<"+uri+"> istg:region ?region. ?region gn:name ?regionName}."
	// //+"OPTIONAL{<"+uri+"> istg:state ?state. ?state gn:name ?stateName}."
	// //+"OPTIONAL{<"+uri+"> istg:country ?country. ?country gn:name ?countryName}."
	// //+"OPTIONAL{<"+uri+"> istg:continent ?continent. ?continent gn:name ?continentName}."
	// //+"OPTIONAL{<"+uri+"> <http://purl.org/ontology/bibo/editorlist> ?eList.?eList <http://www.w3.org/2000/01/rdf-schema#member> ?eListMember.?eListMember <http://xmlns.com/foaf/0.1/name> ?editorName.}."
	// //+"OPTIONAL{<"+uri+"> bibo:editor ?editor.?editor foaf:name ?editorName.}."
	// +"OPTIONAL{<"+uri+"> dct:isPartOf ?edited. ?edited dct:isPartOf ?partOf2}."
 //  +"OPTIONAL{<"+uri+"> dct:isPartOf ?editedBookObj. ?editedBookObj a bibo:EditedBook. ?editedBookObj istg:signature ?signature }."
	// +"OPTIONAL{?werke dct:isPartOf <"+uri+">. ?werke dct:title ?werketitel. ?werke bibo:volume ?werkebandnr. }."
 //  //+"OPTIONAL{<"+uri+"> dct:isPartOf ?collectionObj. ?collectionObj a bibo:Collection. ?collectionObj dct:title ?collection }."
 //  +"OPTIONAL{<"+uri+"> istg:themeLocation ?placeObj. ?placeObj gn:name ?placeName }."
 //  +"OPTIONAL{<"+uri+"> bibo:editor ?publisher. ?publisher foaf:name ?editorName}."
	// +"OPTIONAL{<"+uri+"> dct:contributor ?contributor. ?contributor foaf:name ?contributorName}."
	// +"OPTIONAL{<"+uri+"> dct:isPartOf ?issueObj. ?issueObj dct:title ?issueName }."
	// +"OPTIONAL{<"+uri+"> dc:creator ?creatorObj. ?creatorObj foaf:name ?creatorName }."
	// +"OPTIONAL{<"+uri+"> istg:publishingOrganization ?verlagObj. ?verlagObj a foaf:Organization. ?verlagObj foaf:name ?organizationName}."
	// //+"OPTIONAL{<"+uri+"> dct:isPartOf ?verlagObj. ?verlagObj a foaf:Organization. ?verlagObj foaf:name ?organizationName}."
	// +"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc}."
	// +"OPTIONAL{<"+uri+"> istg:continent ?continentObj. ?continentObj dbpedia-prop:commonName ?continentName}."
	// +"OPTIONAL{<"+uri+"> istg:city ?cityObj. ?cityObj dbpedia-prop:commonName ?cityName}."
 //  +"OPTIONAL{<"+uri+"> istg:region ?regionObj. ?regionObj rdf:description ?regionName }."
	// +"OPTIONAL{<"+uri+"> istg:country ?countryObj. ?countryObj dbpedia-prop:commonName ?countryName }."
	// +"OPTIONAL{<"+uri+"> istg:mapType ?mapTypeObj. ?mapTypeObj skos:prefLabel ?mapType }."
	// +"OPTIONAL{<"+uri+"> istg:cartographer ?cartographerObj. ?cartographerObj foaf:lastName ?cartographerLN. }."
	// +"OPTIONAL{<"+uri+"> istg:cartographer ?cartographerObj. ?cartographerObj foaf:firstName ?cartographerFN. }."
	// //+"OPTIONAL{<"+uri+"> dct:isPartOf  ?articleObj. ?articleObj a bibo:Article. ?articleObj istg:maintitle ?article }."
	// +"OPTIONAL{<"+uri+"> istg:historicPlace ?histPlaceObj. ?histPlaceObj istg:historicPlaceName ?histPlaceName }."
	// +"OPTIONAL{<"+uri+"> istg:category ?categoryObj. ?categoryObj rdfs:label ?category }."
	// +"OPTIONAL{<"+uri+"> dct:creator ?authorObj. ?authorObj foaf:name ?authorName }."
	// +"OPTIONAL{<"+uri+"> istg:relief ?seriesNumber}."
	// +"}"
	// +"ORDER BY ASC(?sort)";

	// console.log(request.query);

	// if(xhr){ //cancel previous request
	// 	xhr.abort();
	// }
	// $.ajax({
	// 	beforeSend: function(xhrObj){
	//     xhrObj.setRequestHeader("Accept","application/sparql-results+json");
	//   },
	// 	url: sparqlendpoint,
	// 	type: "POST",
	// 	dataType: "json",
	// 	data: request,
	// 	success: function(json){
	// 		var properties='<table id=\"proptable\" align=\"left\" style=\"font-size:10px;text-align:left;\">';
	// 		console.log("before reduce loadandappend");
	// 		console.log(json);
	// 		count=0;
	// 		json=reducer(json);
	// 		console.log("===after reducer===");
 //      console.log(json);
	// 		var predicatObjectArray = [];
	// 		var objectContainsArray = [];
	// 		//objectContains = [];
	// 		var werkeVorhanden = false;
	// 		$.each(json, function(i){
	// 			predicate=i;
	// 			label=json[i].label[0];
	// 			//object=json[i].z[0];
	// 			object=json[i].z.join(";");
	// 			sortIndex=json[i].sort[0];
	// 			var werkzusatz = ""
	// 			if(!werkeVorhanden){
	// 				if(json[i].werke != undefined && (json[i].werketitel != undefined)){
	// 					werkeVorhanden = true;
	// 					var werke = json[i].werke;
	// 					var werkeSort = [];
	// 					objectContainsArray["label"]="enthält";
	// 					$.each(werke, function(j){
	// 						var tempWerk = [];
	// 						var bandnr = (json[i].werkebandnr[j] != undefined) ? json[i].werkebandnr[j] : json[i].werkebandnr[j-1];
	// 						tempWerk.push(bandnr);
	// 						console.log("bandnr: "+bandnr);
	// 						if(json[i].werketitel[j] != undefined){
	// 							if(werkzusatz == ""){
	// 								werkzusatz="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
	// 								tempWerk.push(werkzusatz);
	// 							}else{
	// 								werkzusatz=werkzusatz +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
	// 								werkzusatz2="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
	// 								tempWerk.push(werkzusatz2);
	// 							}
	// 						}else if(json[i].werketitel[j-1] != undefined){
	// 							werkzusatz=werkzusatz +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j-1]+"</a> ("+bandnr+")";
	// 							werkzusatz2="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
	// 							tempWerk.push(werkzusatz2);
	// 						}
	// 						werkeSort.push(tempWerk);
	// 					});
	// 					objectContainsArray["object"] = werkzusatz;

	// 					werkeSort.sort(function(a,b){
	// 						return a[0]-b[0];
	// 					});

	// 					var werkeSorted = "";
	// 					$.each(werkeSort, function(x){
	// 						if(werkeSorted == ""){
	// 							werkeSorted = werkeSort[x][1];
	// 						} else {
	// 							werkeSorted = werkeSorted +"<br>"+ werkeSort[x][1];
	// 						}
	// 					});
	// 					console.log(werkeSorted);
	// 					objectContainsArray["object"] = werkeSorted;
	// 				}
	// 			}

	// 			if(predicate=="http://vocab.lodum.de/istg/historicPlace" && (object.indexOf("http://") != -1)){
	// 		  	(json[i].histPlaceName !=undefined) ?	object=json[i].histPlaceName[0] : object="unknown";
	// 			}else if(predicate=="http://purl.org/dc/terms/isPartOf"){
	// 				var seriesNumber = [];
	// 				if(json[i].seriesNumber){
	// 					var splittedSeriesNumber = json[i].seriesNumber[0].split("|");
	// 					$.each(splittedSeriesNumber, function(k){
	// 						if(splittedSeriesNumber[k] != ""){
	// 							seriesNumber.push(splittedSeriesNumber[k].split("<>"));
	// 						}
	// 					});
	// 				}
	// 				if(object.indexOf("http://") != -1){
	// 					if(json[i].partOf!=undefined){
	// 						console.log("===partOf2===");
	// 						console.log(json[i].partOf2);
	// 						if(object.indexOf(";") != -1){
	// 							var splitObject = object.split(";");
	// 							var newObject = "";
	// 							$.each(splitObject, function(j){
	// 								var number = ""
	// 								if(newObject == ""){
	// 									if(json[i].partOfDesc!=undefined){
	// 										if(splitObject[j].indexOf("http://") != -1){
	// 											for(l=0;l<seriesNumber.length;l++){
	// 												if(json[i].partOfDesc[j].indexOf(seriesNumber[l][0])!=-1){
	// 													number ="("+ seriesNumber[l][1]+")";
	// 												}
	// 											}
	// 											newObject="<a href=\"javascript:showPartOfDetails('"+splitObject[j]+"');\">"+json[i].partOfDesc[j]+"</a> "+number;
	// 										}else{
	// 											for(l=0;l<seriesNumber.length;l++){
 //                          if(splitObject[j].indexOf(seriesNumber[l][0])!=-1){
 //                            number = "("+seriesNumber[l][1]+")";
 //                          }
 //                        }
	// 											newObject=splitObject[j]+" "+number;
	// 										}
	// 									}
	// 								}else{
	// 									if(splitObject[j].indexOf("http://") != -1){
	// 										for(l=0;l<seriesNumber.length;l++){
 //                        if(json[i].partOfDesc[j].indexOf(seriesNumber[l][0])!=-1){
 //                          number = "("+seriesNumber[l][1]+")";
 //                        }
 //                      }
	// 										newObject=newObject +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+splitObject[j]+"');\">"+json[i].partOfDesc[j]+"</a> "+number;
	// 									}else{
	// 										for(l=0;l<seriesNumber.length;l++){
 //                      	if(splitObject[j].indexOf(seriesNumber[l][0])!=-1){
 //                          number = "("+seriesNumber[l][1]+")";
 //                        }
 //                      }
	// 										newObject=newObject +"<br>"+ splitObject[j]+" "+number;
	// 									}
	// 								}
	// 							});

	// 							object = newObject;
	// 							console.log("newObject");
	// 							console.log(object);
	// 						}else{
	// 							(json[i].partOfDesc!=undefined) ?  object="<a href=\"javascript:showPartOfDetails('"+json[i].partOf[0]+"');\">"+json[i].partOfDesc.join(";")+"</a>" : object="unknown";
	// 							console.log("Object PartOf if only one entry");
	// 							console.log(object);
	// 						}
	// 					}else{
	// 						(json[i].partOfDesc!=undefined)  ?  object=json[i].patOfDesc.join(";") : object="unknown";
	// 						console.log("ELSE");
	// 					}
	// 				} else{
	// 					if(object.indexOf(";") != -1){
	// 						var splitObject = object.split(";");
	// 						var newObject = "";
	// 						$.each(splitObject,function(j){
	// 							var number = "";
	// 							if(newObject == ""){
	// 								for(l=0;l<seriesNumber.length;l++){
 //                		if(splitObject[j].indexOf(seriesNumber[l][0])!=-1){
 //                  		number = "("+seriesNumber[l][1]+")";
 //                		}
 //              		}
	// 								newObject=splitObject[j]+" "+number;
	// 							}else{
	// 								for(l=0;l<seriesNumber.length;l++){
 //                		if(splitObject[j].indexOf(seriesNumber[l][0])!=-1){
 //                  		number = "("+seriesNumber[l][1]+")";
 //                		}
 //              		}
	// 								newObject=newObject +"<br>"+ splitObject[j]+" "+number;
	// 							}
	// 						});
	// 						object = newObject;
	// 					}else{
	// 						var number = "";
	// 						for(l=0;l<seriesNumber.length;l++){
	// 	            if(object.indexOf(seriesNumber[l][0])!=-1){
	// 	              number = "("+seriesNumber[l][1]+")";
	// 	            }
	// 	          }
	// 	          object=object+" "+number;
	// 					}
	// 				}
	// 			}else if(predicate=="http://vocab.lodum.de/istg/technic" && (object.indexOf("http://") != -1)){
	// 				(json[i].technicName!=undefined) ?	object=json[i].technicName.join("; ") : object="unknown";
	// 			}else if(predicate=="http://purl.org/dc/terms/publisher" && (object.indexOf("http://") != -1)){
	// 				(json[i].publisherName!=undefined) ?	object=json[i].publisherName.join("; ") : object="unkown";
	// 			}else if(predicate=="http://purl.org/ontology/bibo/editorlist" /* && (object.indexOf("http://") == -1)*/){
	// 				(json[i].editorName!=undefined) ? object=json[i].editorName.join('; ') : object="unkown";
	// 			}else if(predicate=="http://purl.org/dc/terms/creator" /* && (object.indexOf("http://") != -1)*/){
	// 				(json[i].authorName!=undefined) ? object=json[i].authorName.join('; '): object="unknown";
	// 			}else if(predicate=="http://purl.org/ontology/bibo/editor" /* && (object.indexOf("http://") != -1)*/){
	// 				(json[i].editorName!=undefined) ? object=json[i].editorName.join('; '): object="unknown";
	// 			}else if(predicate=="http://vocab.lodum.de/istg/category" && (object.indexOf("http://") != -1)){
	// 				(json[i].category!=undefined) ? object=json[i].category.join('; '): object="unknown";
	// 			}else if(predicate=="http://vocab.lodum.de/istg/region" && (object.indexOf("http://") != -1)){
	// 				(json[i].regionName!=undefined) ? object=json[i].regionName.join('; '): object="unknown";
	// 	    }else if(predicate=="http://vocab.lodum.de/istg/historicPlace" && (object.indexOf("http://") != -1)){
	// 	      (json[i].histPlaceName!=undefined) ? object=json[i].histPlaceName.join('; '): object="unknown";
	// 	    }else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1)){
	// 	      (json[i].article!=undefined) ? object=json[i].article.join('; '): object="unknown";
	// 	    }else if(predicate=="http://vocab.lodum.de/istg/cartographer" && (object.indexOf("http://") != -1)){
	// 	      (json[i].cartographer!=undefined) ? object=json[i].cartographer.join('; '): object="unknown";
	// 	    }else if(predicate=="http://vocab.lodum.de/istg/mapType" && (object.indexOf("http://") != -1)){
	// 	      (json[i].mapType!=undefined) ? object=json[i].mapType.join('; '): object="unknown";
	// 			}else if(predicate=="http://vocab.lodum.de/istg/city" && (object.indexOf("http://") != -1)){
	// 				(json[i].cityName!=undefined) ? object=json[i].cityName.join('; '): object="unknown";
	// 			}else if(predicate=="http://vocab.lodum.de/istg/country" && (object.indexOf("http://") != -1)){
	// 				(json[i].countryName!=undefined) ? object=json[i].countryName.join('; '): object="unknown";
	// 			}else if(predicate=="http://vocab.lodum.de/istg/continent" && (object.indexOf("http://") != -1)){
	// 	     	(json[i].continentName!=undefined) ? object=json[i].continentName.join('; '): object="unknown";
	// 	   	} else if(predicate=="http://vocab.lodum.de/istg/publishingOrganization" && (object.indexOf("http://") != -1)){
	// 	      (json[i].organizationName!=undefined) ? object=json[i].organizationName.join('; '): object="unknown";
	// 	    }else if(predicate=="http://purl.org/dc/elements/1.1/creator" && (object.indexOf("http://") != -1)){
	// 	      (json[i].creatorName!=undefined) ? object=json[i].creatorName.join('; '): object="unknown";
	// 	    }else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1)){
	// 	      (json[i].issueName!=undefined) ? object=json[i].issueName.join('; '): object="unknown";
	// 			}else if(predicate=="http://vocab.lodum.de/istg/type" && json[i].z[0]=="Q") {
	// 				object = "Quellen";
	// 			}else if(predicate=="http://www.w3.org/2000/01/rdf-schema#comment" && object.indexOf("\n") != -1){
	// 				var newObject = "";
	// 				var split = object.split("\n");
	// 				$.each(split, function(j){
	// 					if(newObject == ""){
	// 						newObject += split[j];
	// 					}else{
	// 						newObject=newObject + "<br>" + split[j];
	// 					}
	// 				});
	// 				object = newObject;
	// 	    }else if(predicate=="http://purl.org/dc/terms/contributor"){
	// 				var newObject = "";
	// 				if(json[i].contributorName != undefined){
	// 					$.each(json[i].contributorName, function(j){
	// 						if(newObject == ""){
	// 							newObject += json[i].contributorName[j];
	// 						}else{
	// 							newObject = newObject + "<br>" + json[i].contributorName[j];
	// 						}
	// 					});
	// 				} else {
	// 					newObject = json[i].z.join("<br>");
	// 				}
	// 				console.log(newObject);
	// 				object = newObject;
	// 			}else if(predicate=="http://vocab.lodum.de/istg/themeLocation" && (object.indexOf("http://") != -1)){
	// 	      (json[i].placeName!=undefined) ? object=json[i].placeName.join('; '): object="unknown";
	// 			}else if(predicate=="http://xmlns.com/foaf/spec/#thumbnail"){
	// 				object=object.split(';');
	// 				o="";
	// 				$.each(object, function(i){
	// 					o+="<div style=\"width:250px;height:250px;\"><img src=\""+object[i]+"\" width=\"100%\" height=\"100%\" alt=\""+object[i]+"\"></div>";
	// 				});
	// 				object=o;
	// 			}

	// 			//generate links for uirs
	// 			if((predicate!="http://xmlns.com/foaf/spec/#thumbnail" && (object.indexOf("http://") != -1)) && (predicate!="http://purl.org/dc/terms/isPartOf")  ){
	// 				object=replaceURLWithHTMLLinks(object);
	// 				object="<a href=\""+object+"\">"+object+"</a>";
	// 			}

	// 			(object=="true") ? object="&radic;":object=object;
	// 			(object=="false" || object=="0" || object=="NUll" || object=="null" || object=="") ? object="&ndash;":object=object;

	// 			if(uri.indexOf("allegro") == -1 && label != "Vorschaubild"){
	// 				predicatObjectArray[count]={};
	// 	    	predicatObjectArray[count]["label"]=label;
	// 	    	predicatObjectArray[count]["object"]=object;
	// 				predicatObjectArray[count]["sort"]=sortIndex;
	// 				count++;
	// 			} else if(uri.indexOf("allegro") != -1 && (label != "Schlagworte" && label != "Geländestrukturen" && label != "Band")){
	// 				predicatObjectArray[count]={};
	// 	    	predicatObjectArray[count]["label"]=label;
	// 	    	predicatObjectArray[count]["object"]=object;
	// 				predicatObjectArray[count]["sort"]=sortIndex;
	// 				count++;
	// 			}
	// 		});

	// 		//sort labels
	// 		predicatObjectArray.sort(function(a,b) {
	// 		    return a.sort - b.sort;
	// 		});

	// 		if(objectContainsArray["object"] != undefined){
	// 			predicatObjectArray.splice(2,0,objectContainsArray);
	// 		}

	// 		//print labels to html table
	// 		//properties="<table>";
	// 		$.each(predicatObjectArray, function(i){
	// 			properties+="<tr><td width=\"150px\" style=\"vertical-align:top;\">"+predicatObjectArray[i].label+"</td><td><span class=\"stringresult\">"+predicatObjectArray[i].object+"</span></td></tr>";
	// 		});
	// 		$("#ajaxloader2").remove();
	// 		div=$("<div id=\"properties\" style=\"min-height:320px;float:left; \">"+properties+"</div> ");

	// 		//add property table to div container
	// 		element.append(div).hide();
	// 		element.slideToggle(300);
	// 		if(highlight){
	// 			//highlight searchterms
	// 			keywords=$.trim($("#searchbox").val()).split(" ");
	// 			$.each(keywords, function(key,value){
	// 				    value=value.replace('"', "").replace('"', "");
	// 					highlightKeywords(value);
	// 			});
	// 		}
	// 	}//end success
	// });//end ajax request
}

/**
 * Handles click event in the overall search results
 * @param  {String} uri        clicked resource uri
 * @param  {Integer} resultID  Index in the overall result array
 * @param  {Boolean} highlight Highlight searchterm
 */
function showProperties(uri,resultID,highlight){
	$("#properties").remove();
	id = resultID;
	propID="#properties_"+resultID;
	resultID="#result_"+resultID;

	$(resultID).append("<span id=\"ajaxloader2\"><br/><img src=\"http://data.uni-muenster.de/files/ajax-loader.gif\"><span>");
	loadAndAppendPropertiesToElement(uri,id,$(propID),highlight);
}

/**
 * Identifies the rdf:type and the corresponding icon
 * @param  {Array} types  Array containing multiple rdf:types
 * @param  {String} type  rdf:type as a string
 * @return {String}       String containing DOM element
 */
function getIcon (types, type) {
	figure = "<figure><img src=\"http://data.uni-muenster.de/istg/document.png\" alt=\"Unbekannter Dokumenttyp\"></figure>";

	if( type !== undefined || types !== undefined){
		if(type === "Elektronische Ressource"){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/CD-ROM.png\" alt=\"CD-ROM\"><figcaption>Disc</figcaption></figure>";
		}else if(type === "Bandaufführung"){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Bandauffuehrung\"><figcaption>Einzel-<br />band</figcaption</figure>";
		}else if(type === "Q") {
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Monographie\"><figcaption>Buch</figcaption</figure>";
		}else if(type === "Zeitschriftenband") {
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Zeitschriftenband.png\" alt=\"Zeitschriftenband\"><figcaption>Zeit-<br />schriften-<br />band</figcaption</figure>";
		}else if(type === "Zeitschrift") {
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Zeitschrift.png\" alt=\"Zeitschrift\" ><figcaption>Zeitschrift</figcaption</figure>";
		}else if(type === "Aufsatz"){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Aufsatz.png\" alt=\"Aufsatz\"><figcaption>Aufsatz</figcaption</figure>";
		}else if( $.inArray("http://purl.org/ontology/bibo/Book", types)!==-1){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Monographie.png\" alt=\"Monographie\"><figcaption>Buch</figcaption</figure>";
		}else if($.inArray("http://purl.org/ontology/bibo/Map", types)!==-1){
			figure = "<figure><img style=\"width:32px;height32px;\" src=\"http://data.uni-muenster.de/istg/images/Karten.png\" alt=\"Karte\"><figcaption>Karte</figcaption</figure>";
		}else if($.inArray("http://purl.org/ontology/bibo/Periodical", types)!==-1 || $.inArray("http://purl.org/ontology/bibo/MultiVolumeBook", types)!==-1){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/mehrbaendiges%20Werk.png\" alt=\"mehrbaendiges Werk\"><figcaption>mehr-<br />bändiges Werk</figcaption</figure>";
		}else if( $.inArray("http://vocab.lodum.de/istg/PicturePostcard", types)!==-1){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Ansichtskarten_2.png\" alt=\"Ansichtskarte\"><figcaption>Ansichts-<br />karte</figcaption</figure>";
		}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", types)!==-1){
			figure = "<figure><img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\"><figcaption></figcaption</figure>";
		}else if( $.inArray("http://purl.org/ontology/bibo/Excerpt", types)!=-1){
			figure = "<figure><img style=\"width:32px;height:32px;\" src=\"http://data.uni-muenster.de/istg/images/Stadtinformationen.png\" alt=\"Stadtinformation\"><figcaption>Stadt-<br />information</figcaption</figure>";
		}
	}
	return figure;
}

/*
*helper function for sorting keys in a aszo array
*/
function keys(obj){
  var keys = [];
  for(var key in obj)
  {
    if(obj.hasOwnProperty(key))
    {
      keys.push(key);
    }
  }
  return keys;
}

function highlightKeywords(keyword){
	keyword=$.trim(keyword);
	keyword=keyword.replace('"',"");
	if(keyword != "")
	{
		var el = $(".stringresult");
		var pattern = new RegExp("("+keyword+")", ["gi"]);
		var rs = "<span id='highlight'>$1</span>";
		$.each(el, function(key,val){
			if((val.innerHTML.indexOf("http://") == -1) && (val.innerHTML.indexOf("https://") == -1) && (val.innerHTML.indexOf("<img") == -1 ) ){
				val.innerHTML=val.innerHTML.replace(pattern, rs);
			}
		});
	}
}
//]]>