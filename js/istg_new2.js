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
		
	cat=getURLParameter('type').toLowerCase();
	if(cat!="null"){
		(cat=="literatur")?$('#expertensuche :radio')[2].click():"";
		(cat=="karten")?$('#expertensuche :radio')[0].click():"";
		(cat=="stadtinformationen")?$('#expertensuche :radio')[3].click():"";
		(cat=="ansichtskarten")?$('#expertensuche :radio')[1].click():"";
	}
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

function countProperties(obj) {
    var count = 0;

    for(var prop in obj) {
        if(obj.hasOwnProperty(prop))
            ++count;
    }

    return count;
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


function resultsBack(sort){
	$('#searchbox').val(previousSearchTerm);
	sparqlresultno=previousSparqlResultNo-100;
	diff = overallresultno-currentresultno;
        overallresultno = overallresultno - diff;
	search(sort,previousSparqlResultNo-100);

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
	console.log($sort);
	
	$('div#searchresults').slideDown();

	if($sort != null){
		sparqlresultno=0;
	}

	//if($sort == null){
	//	sparqlresultno=0;
	//	overallresultno=0;
	//	$further=0;
	//}

	//remove whitespaces in front and at the end
	$searchstring=$.trim($('#searchbox').val());
	var back=false;
	if($searchstring.length>2){
		$('.moresearchresults').remove();
		$("#expertensuche").slideUp();
		$("#ajaxloader").slideDown();
		$('.searchresult').remove();
		$("#map").hide();
		$("#dateSlider").hide();
		$("#sortierung").hide();
		
		//reset the sparqlresultno if there is a "new" search
		if($searchstring!=previousSearchTerm){
				sparqlresultno=0;
				overallresultno=0;
				$sort=null;
				back=false;
		}else{
			console.log("SEARCH");
			console.log(sparqlresultno);
			if(sparqlresultno!=0 && sparqlresultno > 99){
				//Wichtig für weitere ergebnisse
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
				} else if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "http://purl.org/ontology/bibo/Excerpt") {
					$sorting="DESC(?weight) ASC(str(?title)) ";
					$('#abc').css('font-weight','bold');
				} else if($("#expertensuche input[name=type]:checkbox:checked")[0].value == "all") {
					$sorting="DESC(?weight)";
					$('#relevance').css('font-weight','bold');
				}
			} else {
				$sorting="";
			}	
		} else {
			if($sort=="relevanz"){
				$sorting="DESC(?weight)";
				$('#relevance').css('font-weight','bold');
			}else if($sort=="date_desc"){
				//ty+="?x dct:issued ?issued.";
				$sorting="DESC(?weight) DESC(?issued) ";
				$('#dateDesc').css('font-weight','bold');
		 	}else if($sort=="date_asc"){
				//ty+="?x dct:issued ?issued.";
				$sorting="DESC(?weight) ASC(?issued) ";
				$('#dateAsc').css('font-weight','bold');
			}else if($sort=="abc"){
				$sorting="DESC(?weight) ASC(str(?title)) ";
				$('#abc').css('font-weight','bold');
			}
		}



		//OLD sorting 
		//$sorting=" ";
		//console.log("sort variable");
		//console.log($sort);
		//if($sort != undefined){
		//	if($sort=="relevanz"){
		//		$sorting="";
		//	}else if($sort=="date_desc"){
		//		ty+="?x dct:issued ?issued.";
		//		$sorting=" ORDER BY DESC(?issued) ";
		 //	}else if($sort=="date_asc"){
		//		ty+="?x dct:issued ?issued.";
		//		$sorting=" ORDER BY ASC(?issued) ";
		//	}else if($sort=="abc"){
		//		$sorting=" ORDER BY ASC(?title) ";
		//	}
		//}
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
		//OLD: add type restrictions to sparql query                         
		//if($('#expertensuche :radio:checked').size()>0){
		//	if($('#expertensuche :radio:checked')[0].value!="all"){
		//			ty+="{?x rdf:type <"+$('#expertensuche :radio:checked')[0].value+">}.";
		//			displaySearchRestriction+=$('#expertensuche :radio:checked')[0].parentElement.textContent.trim();
		//	}
		//}

		//NEW add type restrictions to sparql query
		var typeRestriction = "FILTER(";                         
		var typeRestriction2 = "FILTER(";
		if($('#expertensuche input[name=type]:checkbox:checked').size() == 1 ){
			if($('#expertensuche input[name=type]:checkbox:checked')[0].value!="all"){
				//ty+="{?x rdf:type <"+$('#expertensuche input[name=type]:checkbox:checked')[0].value+">}.";
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
		
		//if($('#expertensuche input[name=type]:checkbox:checked').size() == 1){
		//	if($('#expertensuche input[name=type]:checkbox:checked')[0].value!="all"){
		//		ty+="{?x rdf:type <"+$('#expertensuche input[name=type]:checkbox:checked')[0].value+">}.";
		//		displaySearchRestriction+=$('#expertensuche input[name=type]:checkbox:checked')[0].parentElement.textContent.trim();
		//	}
		//} else {
                //	checkedTypes = $('#expertensuche input[name=type]:checkbox:checked');
                  //      $.each(checkedTypes, function(index, value){
		//		displaySearchRestriction+=value.parentElement.textContent.trim()+",";
                  //      });
               	//}
		
		
		//OLD add property restrictions to sparql query
		//if($('#expertensuche :checkbox:checked').size()>0){
		//			checks=$('#expertensuche :checkbox:checked');
		//			if(displaySearchRestriction!="") displaySearchRestriction+=" | ";
		//			$.each(checks, function(index, value) { 
		//				displaySearchRestriction+=value.parentElement.textContent.trim()+",";
		//			});
					//remove last
					
				
		//			attributes=$('#expertensuche :checkbox:checked')[0].value.split(',');
		//			if(attributes.length>1){
		//				ty+="FILTER("
		//				$.each(attributes, function(i) { 
		//					ty+="EXISTS{?x <"+attributes[i]+"> ?s.} || "
		//				});
		//				n = ty.lastIndexOf(" ||");
		//				ty =ty.substring(0, n);
		//				ty+=")."
		//				displaySearchRestriction+="";
		//			}else if(attributes.length==1){
		//				ty+="FILTER( EXISTS{?x <"+$('#expertensuche :checkbox:checked')[0].value+"> ?s.}).";
		//			}
		//} 
		
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

			//OLD$.each(checks,function(index){
			//	
			//	attributes=$('#expertensuche input[name=property]:checkbox:checked')[index].value.split(',');
			//	if(attributes.length>1){
			//		ty+="FILTER("
			//		$.each(attributes, function(i) { 
			//			ty+="EXISTS{?x <"+attributes[i]+"> ?s.} || "
			//		});
			//		n = ty.lastIndexOf(" ||");
			//		ty =ty.substring(0, n);
			//		ty+=")."
			//		displaySearchRestriction+="";
			//	}else if(attributes.length==1){
			//		ty+="FILTER( EXISTS{?x <"+attributes[0]+"> ?s.}).";
			//	}
			//});
		}
		
		//console.log("TY after building restrictions");
		//console.log(ty);
		
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
		
		/* build final query*/

		console.log("BEFORE QUERY");
		console.log($searchstring);
		console.log(ty);
		console.log(restrict);
		console.log(typeRestriction);
		console.log(typeRestriction2);
		console.log($sorting);

		request.query = sparqlPrefixes+
		"SELECT DISTINCT ?x ?werke ?werketyp ?title ?title1 ?typ ?longlat ?score ((?weight + xsd:decimal(?score)) as ?ls) "+
		"WHERE {  "+
		"{"+$searchstring+ty
		+"?x istg:icon ?typ."
		+"?y istg:importance ?weight."
		+restrict+typeRestriction
		+"Optional{?x dct:title ?title}."
		+"Optional{?x istg:maintitle ?title} ."
		//+"Optional{?x dct:title ?title} ."
		+"Optional{?x istg:subtitle ?title1} ."
		+"Optional{?x dct:issued ?issued}."
		//+"OPTIONAL{?x istg:themeLocation ?location. ?location wgs84:lat ?lat. ?location wgs84:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."
        	+"OPTIONAL{?x istg:themeLocation ?location. ?location geo-pos:lat ?lat. ?location geo-pos:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."+"}"+
        	"UNION { "+$searchstring+ty+restrict
		+"?y istg:importance ?weight."
        	+"FILTER (EXISTS{?x rdf:type foaf:Person})."
        	+"?werke dc:creator ?x ."
		+"OPTIONAL{?werke istg:icon ?typ}."
        	+"OPTIONAL{?werke istg:cartographer ?x}."
        	+"OPTIONAL{?werke dc:contributor ?x}."
        	+"OPTIONAL{?werke dct:publisher ?x}."
        	+"OPTIONAL{?werke bibo:editor ?x}."
        	+"OPTIONAL{?werke dct:contributor ?x}."
		//+"OPTIONAL{?werke rdf:type ?werketyp}."
        	+typeRestriction2
		+"Optional{?werke dct:title ?title}."
		+"Optional{?werke istg:maintitle ?title} ."
		//+"Optional{?werke dct:title ?title} ."
		+"Optional{?werke istg:subtitle ?title1} ."
		+"Optional{?werke dct:issued ?issued}."
		//+"OPTIONAL{?werke istg:themeLocation ?location. ?location wgs84:lat ?lat. ?location wgs84:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."
        	+"OPTIONAL{?werke istg:themeLocation ?location. ?location geo-pos:lat ?lat. ?location geo-pos:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."+"}"        

		+" }" +"ORDER BY "+ $sorting + " LIMIT "+ $limit +off;
		

		/*OLD build final query*/
		//request.query = sparqlPrefixes+
		//"SELECT DISTINCT ?x ?title ?title1 ?typ ?longlat "+
		//"WHERE {  "+
		//$searchstring+ty
		//+"Optional{?x istg:maintitle ?title} ."
		//+"Optional{?x dct:title ?title} ."
		//+"Optional{?x istg:subtitle ?title1} ."
		//+"Optional{?x dct:issued ?issued}."
		//+"OPTIONAL{?x istg:themeLocation ?location. ?location wgs84:lat ?lat. ?location wgs84:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."

                //+"OPTIONAL{?x istg:themeLocation ?location. ?location geo-pos:lat ?lat. ?location geo-pos:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."

		//+" }"+ $sorting +" LIMIT "+ $limit +off;
		
		console.log(request.query);		
		

		if(xhr){ //cancel previous request
			xhr.abort();
		}
		
		if($fireCount){
			//console.log("fireCount");
			getSearchResults($searchstring,restrict,typeRestriction,typeRestriction2);
		} else {
		//NEW QUERY//
		var graph = "";
		if($('#expertensuche input[name=type]:checkbox:checked').val() == "http://vocab.lodum.de/istg/PicturePostcard"){
			graph = "<http://data.uni-muenster.de/context/istg/ansichtskarten>"
		} else if($('#expertensuche input[name=type]:checkbox:checked').val() == "http://purl.org/ontology/bibo/Map"){
			graph = "<http://data.uni-muenster.de/context/istg/karten>"	
		} else if($('#expertensuche input[name=type]:checkbox:checked').val() == "http://vocab.lodum.de/istg/WrittenResource"){
			graph = "<http://data.uni-muenster.de/context/istg/allegro>"
                } else if($('#expertensuche input[name=type]:checkbox:checked').val() == "http://purl.org/ontology/bibo/Excerpt"){
			graph = "<http://data.uni-muenster.de/context/istg/stadtinformationen>"
                }



		//request.query = sparqlPrefixes+
                //"SELECT DISTINCT ?x ?werke ?werketyp ?title ?title1 ?typ ?longlat ?weight ?score ((?weight + xsd:decimal(?score)) as ?ls) "+
                //"WHERE {  "+
		//"GRAPH " + graph +
		//"{"+$searchstring+
		//"?x ?y ?s. ?x istg:icon ?typ."+
		//"}"+
		//"GRAPH <http://data.uni-muenster.de/context/istg/weight>"+
		//"{"+
		//"?y istg:importance ?weight."+
		//"}"+
		//"OPTIONAL{?x dct:title ?title}."+
                //"OPTIONAL{?x istg:maintitle ?title}."+
                //"OPTIONAL{?x istg:subtitle ?title1}."+
                //"OPTIONAL{?x dct:issued ?issued}."+
                //"OPTIONAL{?x istg:themeLocation ?location. ?location geo-pos:lat ?lat. ?location geo-pos:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}"+
		//"} ORDER BY DESC(?weight) ASC(?title) LIMIT 100";
		//console.log(request.query);
		}
		xhr = $.ajax({
					beforeSend: function(xhrObj){
						xhrObj.setRequestHeader("Accept","application/sparql-results+json");
					},
					url: sparqlendpoint,
					type: "POST",
					dataType: "json",
					data: request,
					timeout:50000,
					complete: function(jqXHR,status){
						if(status=="timeout"){
							$('.searchresult').remove();
							$('.error').remove();
							$("#ajaxloader").hide();
							if($sort != undefined){
								$("#searchresults").append("<div class='error'>Ihre Treffermenge ist leider zu groß für eine Umsortierung!</div>");
		
							}else{
								$("#map").hide();
								$("#searchresults").append("<div class='error'>Die Anfrage dauert zu lange, da stimmt etwas nicht ! Bitte variieren oder spezifizieren Sie Ihre Suchworte und lockern Sie ggf. die Einschränkungen in der <span onclick=\"javascript:toggleItemList('#expertensuche');\" style=\"cursor: pointer;padding-top:0.5em;\">\"&raquo;Expertensuche\".</span>!</div>");
		
							}
				}
					},
					success: function(json, status, jqXHR){
						if(status=="success"){
							$('.error').remove();
							$('.searchresult').remove();
							$("#ajaxloader").hide();
							console.log("JSON Results");
							console.log(json);
							if(json.results.bindings.length>0){
								$("#sortierung").slideDown();
								//create new marker array
								markerArray = {};
								titleArray = {};
								latlongArray =new Array();
								//reduce sparql result
								previousSparqlResultNo=sparqlresultno;
								sparqlresultno+=json.results.bindings.length;
							//	console.log(sparqlresultno);
								json=reducer(json);
								//count = countProperties(json);
								console.log("Reduced JSON");
								console.log(json);
								reducedjson = json;
								//sparqlresultno += Object.keys(json).length;
								console.log("SparqlResultNo");
								console.log(sparqlresultno);
								//$("#searchResultCount").text("Suchergebnisse ("+countProperties(json)+")");
								currentresultno=0;
								var j=0;
								searchCount = 0;
								werke = null;
								$.each(json, function(i){
									werke = null;
									j++;
									overallresultno++;
									currentresultno++;
									title="no title";
									if( json[i].title!= undefined){
										title=json[i].title[0];
									}else if( json[i].title1 != undefined){
										title=json[i].title1[0];
									}
									subtitle="";
									if(json[i].title1 != undefined){
										subtitle=json[i].title1;
									}
									
									//create array for marker
									if(json[i].longlat!= undefined){
										markerArray[i]= json[i].longlat;
									}
									titleArray[i]=title;
									//console.log(json[i].typ);
									//select icon according to the doc type
									icon="<img src=\"http://data.uni-muenster.de/istg/document.png\" alt=\"Unbekannter Dokumenttyp\">";
									if( json[i].typ != undefined){
										if( $.inArray("http://purl.org/ontology/bibo/Book", json[i].typ)!=-1){
											icon="<img src=\"http://data.uni-muenster.de/istg/book.png\" alt=\"Buch\">";
										}else if($.inArray("http://purl.org/ontology/bibo/Map", json[i].typ)!=-1){
											icon="<img src=\"http://data.uni-muenster.de/istg/map.png\" alt=\"Karte\">";
										}else if($.inArray("http://purl.org/ontology/bibo/Periodical", json[i].typ)!=-1){
											icon="<img src=\"http://data.uni-muenster.de/istg/page_copy.png\" alt=\"Reihe\">";
										}else if( $.inArray("http://vocab.lodum.de/istg/PicturePostcard", json[i].typ)!=-1){
											icon="<img src=\"http://data.uni-muenster.de/istg/postcard.png\" alt=\"Ansichtskarte\">";
										}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].typ)!=-1){
											icon="<img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\">";
										}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].typ)!=-1){
											icon="<img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\">";
										}else if($.inArray("http://xmlns.com/foaf/spec/#Person", json[i].typ)!=-1){
											werke = json[i].werke;
											if( $.inArray("http://purl.org/ontology/bibo/Book", json[i].werketyp)!=-1){
                                                                                        	icon="<img src=\"http://data.uni-muenster.de/istg/book.png\" alt=\"Buch\">";
                                                                                	}else if($.inArray("http://purl.org/ontology/bibo/Map", json[i].werketyp)!=-1){
                                                                                        	icon="<img src=\"http://data.uni-muenster.de/istg/map.png\" alt=\"Karte\">";
                                                                                	}else if($.inArray("http://purl.org/ontology/bibo/Periodical", json[i].werketyp)!=-1){
                                                                                        	icon="<img src=\"http://data.uni-muenster.de/istg/page_copy.png\" alt=\"Reihe\">";
                                                                                	}else if( $.inArray("http://vocab.lodum.de/istg/PicturePostcard", json[i].werketyp)!=-1){
                                                                                        	icon="<img src=\"http://data.uni-muenster.de/istg/postcard.png\" alt=\"Ansichtskarte\">";
                                                                                	}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].werketyp)!=-1){
                                                                                        	icon="<img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\">";
                                                                                	}else if( $.inArray("http://vocab.lodum.de/istg/Atlas", json[i].werketyp)!=-1){
                                                                                        	icon="<img src=\"http://data.uni-muenster.de/istg/atlas.png\" alt=\"Atlas\">";
                                                                                	}
										}
									} 
									
									if(json[i].werke != undefined){
										werke = json[i].werke;
									}									

									if(werke != undefined){
										$.each(werke,function(index){
											searchCount++;
											var werk = werke[index];
											$("#searchresults").append("<div style=\"float:left; border:1px solid #cac9d0;padding:1em;min-height:50px;margin-top:20px;\" class='searchresult' id='result_"+j+"_outer' >"
											+"<div id='result_"+i+"'><div style=\"width:32px;height:32px;float:left;\">"+icon+"</div>"
											+"<a name=\""+werk.hashCode()+"\"></a><a href=\"javascript:showProperties('"+werke[index]+"','"+j+"','true')\"><span class=\"stringresult\">" + title+ "</span></a>"
											+"</span><br/><span style=\"font-size:9px;\">"+subtitle+"</span></div><div id=\"properties_"+j+"\" style=\"float:left;\" ></div><p style=\"clear:both;\"></p></div><p style=\"clear:both;\"></p> ");
										});
									} else {
										searchCount++;
										$("#searchresults").append("<div style=\"float:left; border:1px solid #cac9d0;padding:1em;min-height:50px;margin-top:20px;\" class='searchresult' id='result_"+j+"_outer' >"
										+"<div id='result_"+i+"'><div style=\"width:32px;height:32px;float:left;\">"+icon+"</div>"
										+"<a name=\""+i.hashCode()+"\"></a><a href=\"javascript:showProperties('"+i+"','"+j+"','true')\"><span class=\"stringresult\">" + title+ "</span></a>"
										+"</span><br/><span style=\"font-size:9px;\">"+subtitle+"</span></div><div id=\"properties_"+j+"\" style=\"float:left;\" ></div><p style=\"clear:both;\"></p></div><p style=\"clear:both;\"></p> ");		
									}
									
									//$("#searchresults").append("<div style=\"border:1px solid #cac9d0;padding:1em;width:700px;min-height:50px;margin-top:20px;\" class='searchresult' id='result_"+j+"_outer' >"
									//+"<div id='result_"+i+"'><div style=\"width:32px;height:32px;float:left;\">"+icon+"</div>"
									//+"<a name=\""+i.hashCode()+"\"></a><a href=\"javascript:showProperties('"+i+"','"+j+"','true')\"><span class=\"stringresult\">" + title+ "</span></a>"
									//+" &nbsp;<a  class='rawdata' target='_blank' title='Raw data for this URI' href='" + i + "'>&rarr;</a></span><br/><span style=\"font-size:9px;\">"+subtitle+"</span></div><div id=\"properties_"+j+"\" style=\"float:left;\" ></div><p style=\"clear:both;\"></p></div><p style=\"clear:both;\"></p> ");
								}) //end each json

								//$("#searchResultCount").text("Suchergebnisse ("+searchCount+")");								

								if($offset!=null && $offset!="" && $offset!=0){
									
									previousSparqlOffset=$offset;
									$further=$offset+$limit;
								}else{
									$further=$limit;
								}
								
								console.log("further: "+$further);
								console.log("overallresultno: "+overallresultno);
								console.log("currentresultno: "+currentresultno);
								console.log(overallresultno-currentresultno);
								console.log("back: "+back);
								if(!back && overallresultno != currentresultno){
									diff = overallresultno - currentresultno;
									overallresultno -= diff;
									console.log("Overall new: "+overallresultno);
								}

								console.log("===BUILDING===");
								console.log("SPARQLRESULTNO: "+sparqlresultno);
								console.log("FURTHER: "+$further);
								console.log("PREVIOUS: "+previousSparqlOffset);
								if(sparqlresultno==$further){
									if($sort==undefined){
										sort = null
									} else {
										sort = "'"+$sort+"'";
									}
									(back) ? backHTML="<a disabled="+'"<%= bit>"'+" href=\"javascript:resultsBack("+sort+")\"><< vorherige Ergebnisse</a> |"+(overallresultno-currentresultno)+"-"+overallresultno+"| " : backHTML="|1-"+overallresultno+"|";
									moreresults="<span style=\"float:left;\" class=\"moresearchresults\">"+backHTML+" <a href=\"javascript:search("+sort+","+sparqlresultno+",false)\">weitere Ergebnisse >></a></span>";
									$("#searchresults").prepend(moreresults);
									$("#searchresults").append(moreresults);
								}else if(sparqlresultno > previousSparqlOffset && sparqlresultno < $further){
									(back) ? backHTML="<a style=\"float:left;\" href=\"javascript:resultsBack("+sort+")\"><< vorherige Ergebnisse</a> |"+(overallresultno-currentresultno)+"-"+overallresultno+"| " : backHTML="";
									moreresults="<span class=\"moresearchresults\">"+backHTML;
									$("#searchresults").prepend(moreresults);
									$("#searchresults").append(moreresults);
								}
								
							}else{
									$("#map").hide();
									$("#searchresults").append("<div class='error'>Ihre Suchanfrage erzielte leider keine Treffer. Bitte variieren oder spezifizieren Sie Ihre Suchworte und lockern Sie ggf. die Einschränkungen in der <span onclick=\"javascript:toggleItemList('#expertensuche');\" style=\"cursor: pointer;padding-top:0.5em;\">\"&raquo;Expertensuche\".</span></div>");
									
								
							}
						

						
							//highlight searchterms
							keywords=$.trim($("#searchbox").val()).split(" ");
							$.each(keywords, function(key,value){
								highlightKeywords(value);
							});
						
							
							
							if(!$.isEmptyObject( markerArray )){
								$("#map").show();
								//check if map has already been init
								if(map==null){
									map = new L.Map('map');
									var cloudmade = new L.TileLayer('http://{s}.tile.cloudmade.com/9aed1b5fb54f46c4b2054776a0b080aa/997/256/{z}/{x}/{y}.png', {
									    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://cloudmade.com">CloudMade</a>',
									    maxZoom: 18
									});
									var ms = new L.LatLng( 49.919, 9.8);
									map.addLayer(cloudmade);
								} 
								map.invalidateSize();
								
								//new L.Util.requestAnimFrame(map.invalidateSize,map,!1,map._container); 
								//markerGroup.clearLayers();
								markerCluster.clearLayers();
								$.each(markerArray, function(i){
									ll=markerArray[i];
									$.each(ll, function(u){
										longlat=ll[u].split(",");
										latln=new L.LatLng(longlat[1],longlat[0]);
										latlongArray.push(latln)
										var marker = new L.Marker(latln);
										marker.bindPopup("<a href=\"#"+i.hashCode()+"\">"+titleArray[i]+"</a>");
										//markerGroup.addLayer(marker);
										markerCluster.addLayer(marker);
									});
								});
								//map.addLayer(markerGroup);
								map.addLayer(markerCluster);
								map.fitBounds(new L.LatLngBounds(latlongArray));
								if(map.getZoom()>15){
									map.setZoom(12);
								}
							} //end if check emptyObject
						
						}
					}
		}); //end xhr object
		
	}//end if check for searchterm length
	
}//end function load Results

var searchresults;

function getSearchResults(searchstring,restriction,typeRestriction,typeRestriction2){
	var request = { accept : 'application/sparql-results+json' };
	request.query = sparqlPrefixes+
	"SELECT DISTINCT (COUNT(DISTINCT ?x) AS ?counter)"+
	"WHERE{ {"+searchstring+ 
    	"?x ?y ?s."+
    	typeRestriction+"}"+
	"UNION {"+ searchstring+
    	"?x ?y ?s."+
    	"?werke dc:creator ?x ."+
    	"FILTER(EXISTS{?x rdf:type foaf:Person})."+
    	typeRestriction2+
    	"}"+
	"}";
	console.log(request.query);
	searchresult = $.ajax({
        	beforeSend: function(xhrObj){
                	xhrObj.setRequestHeader("Accept","application/sparql-results+json");
                },
                url: sparqlendpoint,
                type: "POST",
                dataType: "json",
                data: request,
                timeout:50000,
                success: function(json, status, jqXHR){
			$("#searchResultCount").text("Suchergebnisse ("+json.results.bindings[0].counter.value+")");
		}
	});

}


var popUp;
var lastVisitedLinks = [];
function showPartOfDetails(uri,invokedBy){

	console.log("===Function parameters===");
	console.log(uri);
	console.log(invokedBy);

	if(popUp!=undefined){
		popUp.close()
	}	

	div=$("<div id=\"popup\"></div>");
	loadAndAppendPropertiesToElement(uri,div);	

	if(invokedBy != "back"){
//		loadAndAppendPropertiesToElement(uri,div);
		lastVisitedLinks.push(uri);
//		$("#dialog").empty().append(div).dialog("open");
	} else {
		lastVisitedLinks.pop();
	}

	if(lastVisitedLinks.length > 1){
		$("#backBtn").removeClass("hidden");
	} else {
		$("#backBtn").addClass("hidden");
	}

	$("#dialog").empty().append(div).dialog("open");

	/*popUp=$.modal(div, {
		containerCss:{
			align: "left",
			backgroundColor:"#C8C8C8",
			borderColor:"#505050",
			color:"#000000",
			height:300,
			padding:0,
			width:400
		},
		close:true,
		zIndex: 100
	});*/

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
	
 });

function loadAndAppendPropertiesToElement(uri,element,highlight){
		var request = { accept : 'application/sparql-results+json' };
		request.query = sparqlPrefixes+"SELECT ?y ?z ?label ?sort ?werke ?werketitel ?werkebandnr ?contributorName ?publisherName ?issueName ?signature ?collection ?creatorName ?placeName ?countryName (CONCAT(?cartographerFN, ' ' ,?cartographerLN) AS ?cartographer) ?editorName ?article ?mapType ?histPlaceName ?category ?authorName ?cityName ?regionName ?cityName ?continentName ?technicName ?organizationName ?partOfDesc ?partOf ?partOf2 WHERE {"
		+"<"+uri+"> ?y ?z.?y <http://www.w3.org/2000/01/rdf-schema#label> ?label."
		+"OPTIONAL{?y <http://vocab.lodum.de/istg/displaySort> ?sort}."
	//	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc}."
	//	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc.?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:issued ?partOfIssued.BIND(CONCAT(?partOfDesc,' (',str(?partOfIssued),')') AS ?partOfDesc)}."
	//	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc.?partOf dct:issued ?partOfIssued.BIND(CONCAT(?partOfDesc,' (',str(?partOfIssued),')') AS ?partOfDesc)}."
	/*	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:editorString ?partOfEditorName. BIND(CONCAT(?partOfEditorName,'(Hrsg.):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. BIND(CONCAT(?partOfAuthorName,'(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:editorString ?partOfEditorName. BIND(CONCAT(?partOfEditorName,'(Hrsg.)(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		
		//einzelwerk ist teil von aufsatz und aufsatz von gesamtwerk
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName. BIND(CONCAT(?partOfAuthorName,'(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.)::<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.):<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName.?partPartOf dct:issued ?partPartOfIssued. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.)(',str(?partPartOfIssued),'):<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
	*/
	//	+"OPTIONAL{<"+uri+"> istg:technic ?technic. ?technic foaf:name ?technicName}."
	//	+"OPTIONAL{<"+uri+"> istg:historicalLocation ?histLoc. ?histLoc gn:name ?histLocName}."
	//	+"OPTIONAL{<"+uri+"> bibo:editor ?publisher. ?publisher foaf:name ?editorName}."
	//	+"OPTIONAL{<"+uri+"> istg:cartographer ?cartographer. ?cartographer <http://xmlns.com/foaf/0.1/family_name> ?cartographerName}."
    	//	+"OPTIONAL{<"+uri+"> istg:city ?city. ?city gn:name ?cityName}."
	//	+"OPTIONAL{<"+uri+"> istg:region ?region. ?region gn:name ?regionName}."
	//	+"OPTIONAL{<"+uri+"> istg:state ?state. ?state gn:name ?stateName}."
	//	+"OPTIONAL{<"+uri+"> istg:country ?country. ?country gn:name ?countryName}."
	//	+"OPTIONAL{<"+uri+"> istg:continent ?continent. ?continent gn:name ?continentName}."
	//	+"OPTIONAL{<"+uri+"> <http://purl.org/ontology/bibo/editorlist> ?eList.?eList <http://www.w3.org/2000/01/rdf-schema#member> ?eListMember.?eListMember <http://xmlns.com/foaf/0.1/name> ?editorName.}."
	//	+"OPTIONAL{<"+uri+"> bibo:editor ?editor.?editor foaf:name ?editorName.}."


		+"OPTIONAL{<"+uri+"> dct:isPartOf ?edited. ?edited dct:isPartOf ?partOf2}."
                +"OPTIONAL{<"+uri+"> dct:isPartOf ?editedBookObj. ?editedBookObj a bibo:EditedBook. ?editedBookObj istg:signature ?signature }."
		+"OPTIONAL{?werke dct:isPartOf <"+uri+">. ?werke dct:title ?werketitel. ?werke bibo:volume ?werkebandnr. }."
                //+"OPTIONAL{<"+uri+"> dct:isPartOf ?collectionObj. ?collectionObj a bibo:Collection. ?collectionObj dct:title ?collection }."

                +"OPTIONAL{<"+uri+"> istg:themeLocation ?placeObj. ?placeObj gn:name ?placeName }."
                +"OPTIONAL{<"+uri+"> bibo:editor ?publisher. ?publisher foaf:name ?editorName}."
		+"OPTIONAL{<"+uri+"> dct:contributor ?contributor. ?contributor foaf:name ?contributorName}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?issueObj. ?issueObj dct:title ?issueName }."
		+"OPTIONAL{<"+uri+"> dc:creator ?creatorObj. ?creatorObj foaf:name ?creatorName }."
		+"OPTIONAL{<"+uri+"> istg:publishingOrganization ?verlagObj. ?verlagObj a foaf:Organization. ?verlagObj foaf:name ?organizationName}."
		//+"OPTIONAL{<"+uri+"> dct:isPartOf ?verlagObj. ?verlagObj a foaf:Organization. ?verlagObj foaf:name ?organizationName}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc}."
		+"OPTIONAL{<"+uri+"> istg:continent ?continentObj. ?continentObj dbpedia-prop:commonName ?continentName}."
		+"OPTIONAL{<"+uri+"> istg:city ?cityObj. ?cityObj dbpedia-prop:commonName ?cityName}."		
                +"OPTIONAL{<"+uri+"> istg:region ?regionObj. ?regionObj rdf:description ?regionName }."
		+"OPTIONAL{<"+uri+"> istg:country ?countryObj. ?countryObj dbpedia-prop:commonName ?countryName }."
		+"OPTIONAL{<"+uri+"> istg:mapType ?mapTypeObj. ?mapTypeObj skos:prefLabel ?mapType }."
		+"OPTIONAL{<"+uri+"> istg:cartographer ?cartographerObj. ?cartographerObj foaf:lastName ?cartographerLN. }."
		+"OPTIONAL{<"+uri+"> istg:cartographer ?cartographerObj. ?cartographerObj foaf:firstName ?cartographerFN. }."
		//+"OPTIONAL{<"+uri+"> dct:isPartOf  ?articleObj. ?articleObj a bibo:Article. ?articleObj istg:maintitle ?article }."
		+"OPTIONAL{<"+uri+"> istg:historicPlace ?histPlaceObj. ?histPlaceObj istg:historicPlaceName ?histPlaceName }."
		+"OPTIONAL{<"+uri+"> istg:category ?categoryObj. ?categoryObj rdfs:label ?category }."
		+"OPTIONAL{<"+uri+"> dct:creator ?authorObj. ?authorObj foaf:name ?authorName }."

		+"}"
		+"ORDER BY ASC(?sort)";

		console.log(request.query);

		if(xhr){ //cancel previous request
			xhr.abort();
		}
		
		$.ajax({
					beforeSend: function(xhrObj){
				                xhrObj.setRequestHeader("Accept","application/sparql-results+json");
					        },
					url: sparqlendpoint,
					type: "POST",
					dataType: "json",
					data: request,
					success: function(json){
						var properties='<table id=\"proptable\" align=\"left\" style=\"font-size:10px;text-align:left;\">';
						console.log("before reduce loadandappend");
						console.log(json);
						count=0;
						json=reducer(json);
						console.log("===after reducer===");
                                                console.log(json);								
						var predicatObjectArray = [];
						var objectContainsArray = [];
						//objectContains = [];
						var werkeVorhanden = false;
						$.each(json, function(i){
							predicate=i;
							label=json[i].label[0];
							//object=json[i].z[0];
							object=json[i].z.join(";");
							sortIndex=json[i].sort[0];

				var werkzusatz = ""
				if(!werkeVorhanden){
					if(json[i].werke != undefined && (json[i].werketitel != undefined)){
						werkeVorhanden = true;
						var werke = json[i].werke;
						var werkeSort = [];
						objectContainsArray["label"]="enthält";
						$.each(werke, function(j){
							var tempWerk = [];
							var bandnr = (json[i].werkebandnr[j] != undefined) ? json[i].werkebandnr[j] : json[i].werkebandnr[j-1];
							tempWerk.push(bandnr);
							console.log("bandnr: "+bandnr);
							if(json[i].werketitel[j] != undefined){
								if(werkzusatz == ""){
									werkzusatz="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
									tempWerk.push(werkzusatz);
								}else{
									werkzusatz=werkzusatz +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
									werkzusatz2="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
									tempWerk.push(werkzusatz2);
								}
							} else if(json[i].werketitel[j-1] != undefined){
								werkzusatz=werkzusatz +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j-1]+"</a> ("+bandnr+")";
								werkzusatz2="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
								tempWerk.push(werkzusatz2);
							}
							werkeSort.push(tempWerk);
						});
						objectContainsArray["object"] = werkzusatz;
						
						werkeSort.sort(function(a,b){
							return a[0]-b[0];
						});
						
						var werkeSorted = "";
						$.each(werkeSort, function(x){
							if(werkeSorted == ""){
								werkeSorted = werkeSort[x][1];
							} else {
								werkeSorted = werkeSorted +"<br>"+ werkeSort[x][1];
							}
						}); 
						console.log(werkeSorted);
						objectContainsArray["object"] = werkeSorted;
					}
				}

			if(predicate=="http://vocab.lodum.de/istg/historicPlace" && (object.indexOf("http://") != -1)){
			  (json[i].histPlaceName !=undefined) ?	object=json[i].histPlaceName[0] : object="unknown";
			
                       

			}else if(predicate=="http://purl.org/dc/terms/isPartOf"){
				//console.log(json[i].werke);
				//console.log(json[i].werketitel);
				//var werkzusatz = ""
				//if(json[i].werke != undefined && (json[i].werketitel != undefined)){
				//	var werke = json[i].werke;
				//	objectContainsArray["label"]="enthält";
				//	$.each(werke, function(j){
				//		var bandnr = (json[i].werkebandnr[j] != undefined) ? json[i].werkebandnr[j] : "";
				//		console.log("bandnr: "+bandnr);
				//		if(json[i].werketitel[j] != undefined){
				//			if(werkzusatz == ""){
				//				werkzusatz="<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
				//			}else{
				//				werkzusatz=werkzusatz +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+werke[j]+"');\">"+json[i].werketitel[j]+"</a> ("+bandnr+")";
				//			}
				//		}
				//	});
				//	objectContainsArray["object"] = werkzusatz;
				//}

				if(object.indexOf("http://") != -1){

				if(json[i].partOf!=undefined){
					console.log("===partOf2===");
					console.log(json[i].partOf2);
					if(object.indexOf(";") != -1){
						var splitObject = object.split(";");
						var newObject = "";
						$.each(splitObject, function(j){
									
							if(newObject == ""){
								if(json[i].partOfDesc!=undefined){
									if(splitObject[j].indexOf("http://") != -1){
										newObject="<a href=\"javascript:showPartOfDetails('"+splitObject[j]+"');\">"+json[i].partOfDesc[j]+"</a>";	
									}else{
										newObject=splitObject[j];
									}
								}
								//(json[i].partOfDesc!=undefined) ?  newObject="<a href=\"javascript:showPartOfDetails('"+splitObject[j]+"');\">"+json[i].partOfDesc[j]+"</a>" : object="unknown";
							}else{
								if(splitObject[j].indexOf("http://") != -1){
									newObject=newObject +"<br>"+ "<a href=\"javascript:showPartOfDetails('"+splitObject[j]+"');\">"+json[i].partOfDesc[j]+"</a>";	
								}else{
									newObject=newObject +"<br>"+ splitObject[j];
								}
								//if(json[i].partOfDesc!=undefined){
								//	newObject = newObject +"<br>" + "<a href=\"javascript:showPartOfDetails('"+splitObject[j]+"');\">"+json[i].partOfDesc[j]+"</a>";
								//}
							}			
						});
						
						object = newObject;
						console.log("newObject");
						console.log(object);
					}else{
						(json[i].partOfDesc!=undefined) ?  object="<a href=\"javascript:showPartOfDetails('"+json[i].partOf[0]+"');\">"+json[i].partOfDesc.join(";")+"</a>" : object="unknown";
						console.log("Object PartOf if only one entry");
						console.log(object);
					}

					//(json[i].partOfDesc!=undefined) ?  object="<a href=\"javascript:showPartOfDetails('"+json[i].partOf[0]+"');\">"+json[i].partOfDesc.join(";")+"</a>" : object="unknown";
					//console.log("ELSE IF isPartOf see next line");
					//console.log(object);

				}else{	(json[i].partOfDesc!=undefined)  ?  object=json[i].patOfDesc.join(";") : object="unknown";
				
				}
				
				
					
			}
										

//		        }else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1)){
//                                   (json[i].signature!=undefined) ? object=json[i].signature.join('; '): object="unknown";

		

			 }else if(predicate=="http://vocab.lodum.de/istg/technic" && (object.indexOf("http://") != -1)){
				 (json[i].technicName!=undefined) ?	object=json[i].technicName.join("; ") : object="unknown";
									
									}else if(predicate=="http://purl.org/dc/terms/publisher" && (object.indexOf("http://") != -1)){
										(json[i].publisherName!=undefined) ?	object=json[i].publisherName.join("; ") : object="unkown";
									}else if(predicate=="http://purl.org/ontology/bibo/editorlist" /* && (object.indexOf("http://") == -1)*/){
											(json[i].editorName!=undefined) ? object=json[i].editorName.join('; ') : object="unkown";

			 }else if(predicate=="http://purl.org/dc/terms/creator" /* && (object.indexOf("http://") != -1)*/){
				  (json[i].authorName!=undefined) ? object=json[i].authorName.join('; '): object="unknown";

			}else if(predicate=="http://purl.org/ontology/bibo/editor" /* && (object.indexOf("http://") != -1)*/){
				(json[i].editorName!=undefined) ? object=json[i].editorName.join('; '): object="unknown";

			 }else if(predicate=="http://vocab.lodum.de/istg/category" && (object.indexOf("http://") != -1)){
				 (json[i].category!=undefined) ? object=json[i].category.join('; '): object="unknown";
									
											
			 }else if(predicate=="http://vocab.lodum.de/istg/region" && (object.indexOf("http://") != -1)){
				 (json[i].regionName!=undefined) ? object=json[i].regionName.join('; '): object="unknown";
									

                            }else if(predicate=="http://vocab.lodum.de/istg/historicPlace" && (object.indexOf("http://") != -1)){
                                    (json[i].histPlaceName!=undefined) ? object=json[i].histPlaceName.join('; '): object="unknown";

                                                                        
                            }else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1)){
                                    (json[i].article!=undefined) ? object=json[i].article.join('; '): object="unknown";

                            }else if(predicate=="http://vocab.lodum.de/istg/cartographer" && (object.indexOf("http://") != -1)){
                                    (json[i].cartographer!=undefined) ? object=json[i].cartographer.join('; '): object="unknown";


                            }else if(predicate=="http://vocab.lodum.de/istg/mapType" && (object.indexOf("http://") != -1)){
                                    (json[i].mapType!=undefined) ? object=json[i].mapType.join('; '): object="unknown";

			    }else if(predicate=="http://vocab.lodum.de/istg/city" && (object.indexOf("http://") != -1)){
				    (json[i].cityName!=undefined) ? object=json[i].cityName.join('; '): object="unknown";

			   }else if(predicate=="http://vocab.lodum.de/istg/country" && (object.indexOf("http://") != -1)){
				   (json[i].countryName!=undefined) ? object=json[i].countryName.join('; '): object="unknown";

			   }else if(predicate=="http://vocab.lodum.de/istg/continent" && (object.indexOf("http://") != -1)){
			           (json[i].continentName!=undefined) ? object=json[i].continentName.join('; '): object="unknown";

                           } else if(predicate=="http://vocab.lodum.de/istg/publishingOrganization" && (object.indexOf("http://") != -1)){
                                   (json[i].organizationName!=undefined) ? object=json[i].organizationName.join('; '): object="unknown";

			//else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1)){
                         //          (json[i].organizationName!=undefined) ? object=json[i].organizationName.join('; '): object="unknown";

                           }else if(predicate=="http://purl.org/dc/elements/1.1/creator" && (object.indexOf("http://") != -1)){
                                   (json[i].creatorName!=undefined) ? object=json[i].creatorName.join('; '): object="unknown";


                           }else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1)){
                                   (json[i].issueName!=undefined) ? object=json[i].issueName.join('; '): object="unknown";
				     

			}else if(predicate=="http://www.w3.org/2000/01/rdf-schema#comment" && (object.indexOf("\n") != -1)){
				var newObject = "";
				var split = object.split("\n");
				$.each(split, function(j){
					if(newObject == ""){
						newObject += split[j];
					}else{
						newObject=newObject + "<br>" + split[j];
					}
				});
				object = newObject;
						
                         }else if(predicate=="http://purl.org/dc/terms/contributor"){
				var newObject = "";
				if(json[i].contributorName != undefined){
					$.each(json[i].contributorName, function(j){
						if(newObject == ""){
							newObject += json[i].contributorName[j];
						}else{
							newObject = newObject + "<br>" + json[i].contributorName[j];
						}
					});
				} else {
					newObject = json[i].z.join("<br>");
				}
				console.log(newObject);
				object = newObject;

			} else if(predicate=="http://vocab.lodum.de/istg/themeLocation" && (object.indexOf("http://") != -1)){
                                    (json[i].placeName!=undefined) ? object=json[i].placeName.join('; '): object="unknown";

                             	

									}else if(predicate=="http://xmlns.com/foaf/spec/#thumbnail"){
										object=object.split(';');
										o="";
										$.each(object, function(i){
											    o+="<div style=\"width:250px;height:250px;\"><img src=\""+object[i]+"\" width=\"100%\" height=\"100%\" alt=\""+object[i]+"\"></div>";
										});
										object=o;
										

									}

									//generate links for uirs
									if((predicate!="http://xmlns.com/foaf/spec/#thumbnail" && (object.indexOf("http://") != -1)) && (predicate!="http://purl.org/dc/terms/isPartOf")  ){
										object=replaceURLWithHTMLLinks(object);
										object="<a href=\""+object+"\">"+object+"</a>";
									}

									(object=="true") ? object="&radic;":object=object;
									(object=="false" || object=="0" || object=="NUll" || object=="null" || object=="") ? object="&ndash;":object=object;
									
									if(uri.indexOf("allegro") == -1 && label != "Vorschaubild"){
										predicatObjectArray[count]={};
                                                                        	predicatObjectArray[count]["label"]=label;
                                                                        	predicatObjectArray[count]["object"]=object;
										predicatObjectArray[count]["sort"]=sortIndex;
										count++;
									} else if(uri.indexOf("allegro") != -1 && label != "Schlagworte"){
										predicatObjectArray[count]={};
                                                                        	predicatObjectArray[count]["label"]=label;
                                                                        	predicatObjectArray[count]["object"]=object;
										predicatObjectArray[count]["sort"]=sortIndex;
										count++;
									}
									//predicatObjectArray[count]={};
									//predicatObjectArray[count]["label"]=label;
									//predicatObjectArray[count]["object"]=object;
									//predicatObjectArray[count]["sort"]=json[i].sort[0];
									//.push({"label":label,"object":object,"sort":json[i].sort[0]});
								//	properties+="<tr><td width=\"150px\" style=\"vertical-align:top;\">"+label+"</td><td><span class=\"stringresult\">"+object+"</span></td></tr>";
									//count++;
								});								

								//sort labels
								predicatObjectArray.sort(function(a,b) {
								    return a.sort - b.sort;
								});

								if(objectContainsArray["object"] != undefined){
									predicatObjectArray.splice(1,0,objectContainsArray);
								}								

								//print labels to html table
								//properties="<table>";
								$.each(predicatObjectArray, function(i){
												properties+="<tr><td width=\"150px\" style=\"vertical-align:top;\">"+predicatObjectArray[i].label+"</td><td><span class=\"stringresult\">"+predicatObjectArray[i].object+"</span></td></tr>";
								});
								$("#ajaxloader2").remove();
								div=$("<div id=\"properties\" style=\"min-height:320px;float:left; \">"+properties+"</div><p style=\"clear:both;\"></p> ");

								//add property table to div container 
								element.append(div).hide();
								element.slideToggle(300);
								if(highlight){
									//highlight searchterms
									keywords=$.trim($("#searchbox").val()).split(" ");
									$.each(keywords, function(key,value){
										    value=value.replace('"', "").replace('"', "");
											highlightKeywords(value);
									});	
								}

								
					}//end success

		});//end ajax request 

}

	
function showProperties(uri,resultID,highlight){
	$("#properties").remove();	
	propID="#properties_"+resultID;
	resultID="#result_"+resultID;
	
	$(resultID).append("<span id=\"ajaxloader2\"><br/><img src=\"http://data.uni-muenster.de/files/ajax-loader.gif\"><span>");
	loadAndAppendPropertiesToElement(uri,$(propID),highlight);
	

}//end function showProperties

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
