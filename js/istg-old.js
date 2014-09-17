//<![CDATA[


//initialize all elements, after dom is loaded
 $(document).ready(function () {
	$("#ajaxloader").hide();
	$("#expertensuche").hide();
	$("#sortierung").hide();
	$("#searchbox").keypress(function(event){
		if(event.keyCode == 13){
		        search();
		    }
	});
		
	cat=getURLParameter('type').toLowerCase();
	if(cat!="null"){
		(cat=="literatur")?$('#expertensuche :radio')[0].click():"";
		(cat=="karten")?$('#expertensuche :radio')[1].click():"";
		(cat=="atlanten")?$('#expertensuche :radio')[2].click():"";
		(cat=="ansichtskarten")?$('#expertensuche :radio')[3].click():"";
	}
	query=getURLParameter('query');
	if(query!="null" && query.length>2){
		$('#searchbox').val(query);
		search();
	}

});



/* global vars */
var map=null;
var sparqlendpoint="http://data.uni-muenster.de:8080/openrdf-sesame/repositories/istg";
var $limit = 100;
var sparqlresultno=0;
var sparqlPrefixes="prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> "+
"PREFIX foaf: <http://xmlns.com/foaf/0.1/> "+
"PREFIX luc: <http://www.ontotext.com/owlim/lucene#> "+
"PREFIX istg: <http://vocab.lodum.de/istg/> "+
"PREFIX dct: <http://purl.org/dc/terms/> "+
"PREFIX gn: <http://www.geonames.org/ontology#>"+
"PREFIX wgs84: <http://www.w3.org/2003/01/geo/wgs84_pos#>"+
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


function resultsBack(){
	$('#searchbox').val(previousSearchTerm);
	sparqlresultno=previousSparqlResultNo-100;
	search(null,previousSparqlResultNo-100);

}


		
var xhr;
var markerArray;
var titleArray;
var latlongArray;
var markerGroup = new L.LayerGroup();
var previousSearchTerm="";
var previousSparqlResultNo=0;
var previousSparqlOffset=0;
var overallresultno=0;
var stringSimilarity="~0.9 ";
function search($sort,$offset){
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
		}else{
			if(sparqlresultno!=0){
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
			$wholestring=$searchstring;
			$searchstring="?s luc:istgLiteralIndex '";
			$.each(tokens, function(index, value) { 
				if(index>0){
					$searchstring+=" && "+value;
				}else{
					$searchstring+=value;
				}

			});
			$searchstring+="' .";
		}else if($searchstring.indexOf(" ") != -1){
			//split searchterm in single terms
			tokens=$searchstring.split(" ");
			$wholestring=$searchstring;
			$searchstring="?s luc:istgLiteralIndex '";
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
			$searchstring = "?s luc:istgLiteralIndex \"*"+$searchstring+"*"+stringSimilarity+"\".";
		}

		//start building sparql string
		ty="?x ?y ?s.?x rdf:type ?typ.";
		//add sorting options to query (no sort = sorting by lucene relevance)
		$sorting=" ";
		if($sort != undefined){
			if($sort=="relevanz"){
				$sorting="";
			}else if($sort=="date_desc"){
				ty+="?x dct:issued ?issued.";
				$sorting=" ORDER BY DESC(?issued) ";
		 	}else if($sort=="date_asc"){
				ty+="?x dct:issued ?issued.";
				$sorting=" ORDER BY ASC(?issued) ";
			}else if($sort=="abc"){
				$sorting=" ORDER BY ASC(?title) ";
			}
		}
		off="";
		if($offset!=null){
			off=" OFFSET "+$offset+1;
		}
		ty+="FILTER(!EXISTS{?x rdf:type foaf:Person} && !EXISTS{?x istg:publishingLocation ?s} && !EXISTS{?x foaf:name ?s} && !EXISTS{?x gn:name ?s} &&  !EXISTS{?x bibo:owner ?s}). ";
		
		var displaySearchRestriction="";
		//add type restrictions to sparql query                         
		if($('#expertensuche :radio:checked').size()>0){
			if($('#expertensuche :radio:checked')[0].value!="all"){
					ty+="{?x rdf:type <"+$('#expertensuche :radio:checked')[0].value+">}.";
					displaySearchRestriction+=$('#expertensuche :radio:checked')[0].parentElement.textContent.trim();
			}
		}
		
		
		//add property restrictions to sparql query
		if($('#expertensuche :checkbox:checked').size()>0){
					checks=$('#expertensuche :checkbox:checked');
					if(displaySearchRestriction!="") displaySearchRestriction+=" | ";
					$.each(checks, function(index, value) { 
						displaySearchRestriction+=value.parentElement.textContent.trim()+",";
					});
					//remove last
					
				
					attributes=$('#expertensuche :checkbox:checked')[0].value.split(',');
					if(attributes.length>1){
						ty+="FILTER("
						$.each(attributes, function(i) { 
							ty+="EXISTS{?x <"+attributes[i]+"> ?s.} || "
						});
						n = ty.lastIndexOf(" ||");
						ty =ty.substring(0, n);
						ty+=")."
						displaySearchRestriction+="";
					}else if(attributes.length==1){
						ty+="FILTER( EXISTS{?x <"+$('#expertensuche :checkbox:checked')[0].value+"> ?s.}).";
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
		



		/* build final query*/
		request.query = sparqlPrefixes+
		"SELECT DISTINCT ?x ?title ?title1 ?typ ?longlat "+
		"WHERE {  "+
		$searchstring+ty
		+"Optional{?x istg:maintitle ?title} ."
		+"Optional{?x dct:title ?title} ."
		+"Optional{?x istg:subtitle ?title1} ."
		//+"Optional{?x dct:issued ?issued}."
		+"OPTIONAL{?x istg:themeLocation ?location. ?location wgs84:lat ?lat. ?location wgs84:long ?long.BIND(concat(concat(str(?long),','),str(?lat)) as ?longlat).}."
		+" }"+ $sorting +" LIMIT "+ $limit +off;
		
		
		

		if(xhr){ //cancel previous request
			xhr.abort();
		}


		xhr = $.ajax({
					beforeSend: function(xhrObj){
						xhrObj.setRequestHeader("Accept","application/sparql-results+json");
					},
					url: sparqlendpoint,
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
					success: function(json,status, jqXHR){
						if(status=="success"){
							$('.error').remove();
							$('.searchresult').remove();
							$("#ajaxloader").hide();
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
								currentresultno=0;
								var j=0;
								$.each(json, function(i){
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
										}
									}
									
									
									$("#searchresults").append("<div style=\"border:1px solid #cac9d0;padding:1em;width:700px;min-height:50px;margin-top:20px;\" class='searchresult' id='result_"+j+"_outer' >"
									+"<div id='result_"+i+"'><div style=\"width:32px;height:32px;float:left;\">"+icon+"</div>"
									+"<a name=\""+i.hashCode()+"\"></a><a href=\"javascript:showProperties('"+i+"','"+j+"','true')\"><span class=\"stringresult\">" + title+ "</span></a>"
									+" &nbsp;<a  class='rawdata' target='_blank' title='Raw data for this URI' href='" + i + "'>&rarr;</a></span><br/><span style=\"font-size:9px;\">"+subtitle+"</span></div><div id=\"properties_"+j+"\" style=\"float:left;\" ></div><p style=\"clear:both;\"></p></div><p style=\"clear:both;\"></p> ");
								}) //end each json
								
								if($offset!=null && $offset!="" && $offset!=0){
									
									previousSparqlOffset=$offset;
									$further=$offset+$limit;
								}else{
									$further=$limit;
								}
								if(sparqlresultno==$further){
									(back) ? backHTML="<a href=\"javascript:resultsBack()\"><< vorherige Ergebnisse</a> |"+(overallresultno-currentresultno)+"-"+overallresultno+"| " : backHTML="";
									moreresults="<span class=\"moresearchresults\">"+backHTML+" <a href=\"javascript:search(null,"+sparqlresultno+")\">weitere Ergebnisse >></a></span>";
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
								markerGroup.clearLayers();
								$.each(markerArray, function(i){
									ll=markerArray[i];
									$.each(ll, function(u){
										longlat=ll[u].split(",");
										latln=new L.LatLng(longlat[1],longlat[0]);
										latlongArray.push(latln)
										var marker = new L.Marker(latln);
										marker.bindPopup("<a href=\"#"+i.hashCode()+"\">"+titleArray[i]+"</a>");
										markerGroup.addLayer(marker);
									});
								});
								map.addLayer(markerGroup);
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

var popUp;
function showPartOfDetails(uri){
	if(popUp!=undefined){
		popUp.close()
	}
	div=$("<div id=\"popup\"></div>");
	loadAndAppendPropertiesToElement(uri,div);

	popUp=$.modal(div, {
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
	});

}

function loadAndAppendPropertiesToElement(uri,element,highlight){
		var request = { accept : 'application/sparql-results+json' };
		request.query = sparqlPrefixes+"SELECT ?y ?z ?label ?sort ?histLocName ?publisherName ?editorName ?authorName ?cityName ?regionName ?stateName ?countryName ?continentName ?technicName ?partOfDesc ?partOf WHERE {"
		+"<"+uri+"> ?y ?z.?y <http://www.w3.org/2000/01/rdf-schema#label> ?label."
		+"OPTIONAL{?y <http://vocab.lodum.de/istg/displaySort> ?sort}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc.?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:issued ?partOfIssued.BIND(CONCAT(?partOfDesc,' (',str(?partOfIssued),')') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfDesc.?partOf dct:issued ?partOfIssued.BIND(CONCAT(?partOfDesc,' (',str(?partOfIssued),')') AS ?partOfDesc)}."
	/*	+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:editorString ?partOfEditorName. BIND(CONCAT(?partOfEditorName,'(Hrsg.):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. BIND(CONCAT(?partOfAuthorName,'(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:editorString ?partOfEditorName. BIND(CONCAT(?partOfEditorName,'(Hrsg.)(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i>') AS ?partOfDesc)}."
	
		//einzelwerk ist teil von aufsatz und aufsatz von gesamtwerk
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf.?partOf dct:issued ?partOfIssued. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName. BIND(CONCAT(?partOfAuthorName,'(',str(?partOfIssued),'):','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.)::<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.):<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
		+"OPTIONAL{<"+uri+"> dct:isPartOf ?partOf. ?partOf dct:title ?partOfTitle.?partOf istg:authorString ?partOfAuthorName. ?partOf dct:isPartOf ?partPartOf. ?partPartOf dct:title ?partPartOfTitle.?partPartOf istg:editorString ?partPartOfEditorName.?partPartOf dct:issued ?partPartOfIssued. BIND(CONCAT(?partOfAuthorName,':','<i>',str(?partOfTitle),'</i><br/> in ',?partPartOfEditorName,'(Hrsg.)(',str(?partPartOfIssued),'):<i>',?partPartOfTitle,'</i>') AS ?partOfDesc)}."
	*/
		+"OPTIONAL{<"+uri+"> istg:technic ?technic. ?technic foaf:name ?technicName}."
		+"OPTIONAL{<"+uri+"> istg:historicalLocation ?histLoc. ?histLoc gn:name ?histLocName}."
		+"OPTIONAL{<"+uri+"> dct:publisher ?publisher. ?publisher foaf:name ?publisherName}."
	//	+"OPTIONAL{<"+uri+"> <http://vocab.lodum.de/istg/cartographer> ?cartographer. ?cartographer <http://xmlns.com/foaf/0.1/family_name> ?cartographerName}."
		+"OPTIONAL{<"+uri+"> istg:city ?city. ?city gn:name ?cityName}."
		+"OPTIONAL{<"+uri+"> istg:region ?region. ?region gn:name ?regionName}."
		+"OPTIONAL{<"+uri+"> istg:state ?state. ?state gn:name ?stateName}."
		+"OPTIONAL{<"+uri+"> istg:country ?country. ?country gn:name ?countryName}."
		+"OPTIONAL{<"+uri+"> istg:continent ?continent. ?continent gn:name ?continentName}."
	//	+"OPTIONAL{<"+uri+"> <http://purl.org/ontology/bibo/editorlist> ?eList.?eList <http://www.w3.org/2000/01/rdf-schema#member> ?eListMember.?eListMember <http://xmlns.com/foaf/0.1/name> ?editorName.}."
		+"OPTIONAL{<"+uri+"> bibo:editor ?editor.?editor foaf:name ?editorName.}."
		+"OPTIONAL{<"+uri+"> istg:authorString ?authorName.}."
		+"}"
		+"ORDER BY ASC(?sort)";
		if(xhr){ //cancel previous request
			xhr.abort();
		}

		$.ajax({
					beforeSend: function(xhrObj){
				                xhrObj.setRequestHeader("Accept","application/sparql-results+json");
					        },
					url: sparqlendpoint,
					dataType: "json",
					data: request,
					success: function(json){
								
								var properties='<table id=\"proptable\" align=\"left\" style=\"font-size:10px;text-align:left;\">';
								count=0;
								json=reducer(json);
								var predicatObjectArray=[];
								$.each(json, function(i){
									predicate=i;
									label=json[i].label[0];
									//object=json[i].z[0];
									object=json[i].z.join(";");
									if(predicate=="http://vocab.lodum.de/istg/historicalLocation" && (object.indexOf("http://") != -1)){
											(json[i].histLocName !=undefined) ?	object=json[i].histLocName[0] : object="unkown";
									}else if(predicate=="http://purl.org/dc/terms/isPartOf" && (object.indexOf("http://") != -1) ){
										if(json[i].partOf!=undefined){
											(json[i].partOfDesc!=undefined) ?	object="<a href=\"javascript:showPartOfDetails('"+json[i].partOf[0]+"');\">"+json[i].partOfDesc.join(";")+"</a>" : object="unkown";
										}else{
											(json[i].partOfDesc!=undefined) ?	object=json[i].partOfDesc.join(";") : object="unkown";
										}
										
									}else if(predicate=="http://vocab.lodum.de/istg/technic" && (object.indexOf("http://") != -1)){
											(json[i].technicName!=undefined) ?	object=json[i].technicName.join("; ") : object="unkown";
									}else if(predicate=="http://purl.org/dc/terms/publisher" && (object.indexOf("http://") != -1)){
										(json[i].publisherName!=undefined) ?	object=json[i].publisherName.join("; ") : object="unkown";
									}else if(predicate=="http://purl.org/ontology/bibo/editorlist" /* && (object.indexOf("http://") == -1)*/){
											(json[i].editorName!=undefined) ? object=json[i].editorName.join('; ') : object="unkown";
									}else if(predicate=="http://purl.org/ontology/bibo/authorlist" /* && (object.indexOf("http://") != -1)*/){
											(json[i].authorName!=undefined) ? object=json[i].authorName.join('; '): object="unkown";
									}else if(predicate=="http://purl.org/ontology/bibo/editor" /* && (object.indexOf("http://") != -1)*/){
											(json[i].editorName!=undefined) ? object=json[i].editorName.join('; '): object="unkown";
									//}else if(predicate=="http://vocab.lodum.de/istg/cartographer" && (object.indexOf("http://") != -1)){
									//		(json[i].cartographerName!=undefined) ? object=json[i].cartographerName.join('; '): object="unkown";
									}else if(predicate=="http://vocab.lodum.de/istg/city" && (object.indexOf("http://") != -1)){
											(json[i].cityName!=undefined) ? object=json[i].cityName.join('; '): object="unkown";
									}else if(predicate=="http://vocab.lodum.de/istg/region" && (object.indexOf("http://") != -1)){
											(json[i].regionName!=undefined) ? object=json[i].regionName.join('; '): object="unkown";
									}else if(predicate=="http://vocab.lodum.de/istg/state" && (object.indexOf("http://") != -1)){
											(json[i].stateName!=undefined) ? object=json[i].stateName.join('; '): object="unkown";
									}else if(predicate=="http://vocab.lodum.de/istg/country" && (object.indexOf("http://") != -1)){
													(json[i].countryName!=undefined) ? object=json[i].countryName.join('; '): object="unkown";
									}else if(predicate=="http://vocab.lodum.de/istg/continent" && (object.indexOf("http://") != -1)){
											(json[i].continentName!=undefined) ? object=json[i].continentName.join('; '): object="unkown";
									}else if(predicate=="http://xmlns.com/foaf/0.1/thumbnail"){
										object=object.split(';');
										o="";
										$.each(object, function(i){
											    o+="<div style=\"width:250px;height:250px;\"><img src=\""+object[i]+"\" width=\"100%\" height=\"100%\" alt=\""+object[i]+"\"></div>";
										});
										object=o;

									}

									//generate links for uirs
									if((predicate!="http://xmlns.com/foaf/0.1/thumbnail" && (object.indexOf("http://") != -1)) && (predicate!="http://purl.org/dc/terms/isPartOf")  ){
										object=replaceURLWithHTMLLinks(object);
										//object="<a href=\""+object+"\">"+object+"</a>";
									}

									(object=="true") ? object="&radic;":object=object;
									(object=="false" || object=="0" || object=="NUll" || object=="null" || object=="") ? object="&ndash;":object=object;
									predicatObjectArray[count]={};
									predicatObjectArray[count]["label"]=label;
									predicatObjectArray[count]["object"]=object;
									predicatObjectArray[count]["sort"]=json[i].sort[0];
									//.push({"label":label,"object":object,"sort":json[i].sort[0]});
								//	properties+="<tr><td width=\"150px\" style=\"vertical-align:top;\">"+label+"</td><td><span class=\"stringresult\">"+object+"</span></td></tr>";
									count++;
								});

								//sort labels
								predicatObjectArray.sort(function(a,b) {
								    return a.sort - b.sort;
								});
								
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
	        var el = $(".stringresult");
	        var pattern = new RegExp("("+keyword+")", ["gi"]);
            var rs = "<span id='highlight'>$1</span>";
			$.each(el, function(key,val){	
				if((val.innerHTML.indexOf("http://") == -1) && (val.innerHTML.indexOf("https://") == -1) && (val.innerHTML.indexOf("<img") == -1 ) ){
								      val.innerHTML=val.innerHTML.replace(pattern, rs);
				}
			})
	}
//]]>
