var displaySort = [
  {
    'property':'dct:title',
    'label':'Titel',
    'sort': 0
  },
  {
    'property': 'dc:creator',
    'label': 'Autor',
    'sort': 1
  },
  {
    'property': 'dct:creator',
    'label': 'Autor',
    'sort': 1
  },
  {
    'property': 'istg:cartographer',
    'label': 'Kartograph',
    'sort': 2
  },
  {
    'property': 'bibo:editor',
    'label': 'Herausgeber',
    'sort': 3
  },
  {
    'property': 'dct:alternative',
    'label': 'Paralleltitel',
    'sort': 6
  },
  {
    'property': 'lido:originaltitel',
    'label': 'Originaltitel',
    'sort': 6
  },
  {
    'property': 'istg:paralleltitle',
    'label': 'Paralleltitel',
    'sort': 7
  },
  {
    'property': 'bibo:editorlist',
    'label': 'Herausgeber',
    'sort': 10
  },
  {
    'property': 'istg:Technique',
    'label': 'Technik',
    'sort': 10
  },
  {
    'property': 'foaf:firastName',
    'label': 'Vorname',
    'sort': 10
  },
  {
    'property': 'foaf:lastName',
    'label': 'Nachname',
    'sort': 10
  },
  {
    'property': 'skos:prefLabel',
    'label': 'Kartentyp',
    'sort': 10
  },
  {
    'property': 'istg:mapType',
    'label': 'Kartentyp',
    'sort': 402
  },
  {
    'property': 'rdf:description',
    'label': 'Technik',
    'sort': 10
  },
  {
    'property': 'istg:federalstate',
    'label': 'Bundesland',
    'sort': 12
  },
  {
    'property': 'istg:plz',
    'label': 'Postleitzahl',
    'sort': 15
  },
  {
    'property': 'istg:historicPlacename',
    'label': 'hist. Ortsname',
    'sort': 16
  },
  {
    'property': 'dct:description',
    'label': 'Bezeichnung',
    'sort': 17
  },
  {
    'property': 'istg:historicPlacenameType',
    'label': 'hist. Ortsnamentyp',
    'sort': 18
  },
  {
    'property': 'istg:historicRegion',
    'label': 'hist. Lage',
    'sort': 10
  },
  {
    'property': 'dct:medium',
    'label': 'Medium',
    'sort': 10
  },
  {
    'property': 'dct:contributor',
    'label': 'Sonstige Beteiligte',
    'sort': 10
  },
  {
    'property': 'bibo:owner',
    'label': 'Beteiligte Institution',
    'sort': 11
  },
  {
    'property': 'bibo:volume',
    'label': 'Bandnr.',
    'sort': 17
  },
  {
    'property': 'istg:reihe',
    'label': 'Band',
    'sort': 16
  },
  {
    'property': 'dct:isPartOf',
    'label': 'in',
    'sort': 15
  },
  {
    'property': 'istg:publishingOrganization',
    'label': 'Verlag',
    'sort': 15
  },
  {
    'property': 'bibo:issue',
    'label': 'Bandnr.',
    'sort': 17
  },
  {
    'property': 'istg:category',
    'label': 'Erscheinungsform',
    'sort': 18
  },
  {
    'property': 'istg:publishingLocation',
    'label': 'Erscheinungsort',
    'sort': 20
  },
  {
    'property': 'dct:publisher',
    'label': 'Verlag',
    'sort': 21
  },
  {
    'property': 'bibo:edition',
    'label': 'Auflage',
    'sort': 22
  },
  {
    'property': 'istg:delivery',
    'label': 'Lieferung',
    'sort': 22
  },
  {
    'property': 'dct:issued',
    'label': 'Erscheinungsjahr',
    'sort': 23
  },
  {
    'property': 'istg:publishingdate',
    'label': 'Erscheinungsjahr',
    'sort': 24
  },
  {
    'property': 'istg:recordingTime',
    'label': 'Aufnahmedatum',
    'sort': 26
  },
  {
    'property': 'istg:displayedTime',
    'label': 'Dargestellte zeit',
    'sort': 27
  },
  {
    'property': 'bibo:pages',
    'label': 'Umfang',
    'sort': 35
  },
  {
    'property': 'bibo:pageStart',
    'label': 'Von Seite',
    'sort': 30
  },
  {
    'property': 'istg:page',
    'label': 'Seite',
    'sort': 37
  },
  {
    'property': 'istg:yearEstimated',
    'label': 'Jahr geschätzt',
    'sort': 31
  },
  {
    'property': 'dct:format',
    'label': 'Format (in cm)',
    'sort': 32
  },
  {
    'property': 'bibo:isbn',
    'label': 'ISBN',
    'sort': 33
  },
  {
    'property': 'bibo:doi',
    'label': 'DOI',
    'sort': 34
  },
  {
    'property': 'bibo:content',
    'label': 'Inhalt',
    'sort': 36
  },
  {
    'property': 'istg:cartographerString',
    'label': 'kartograph',
    'sort': 8
  },
  {
    'property': 'istg:inhaltsverzeichnis',
    'label': 'Inhaltsverzeichnis',
    'sort': 35
  },
  {
    'property': 'istg:rezession',
    'label': 'Rezesion',
    'sort': 35
  },
  {
    'property': 'istg:publishedCustom',
    'label': 'Veröffentlichung',
    'sort': 100
  },
  {
    'property': 'istg:mapScale',
    'label': 'Maßstab',
    'sort': 300
  },
  {
    'property': 'istg:illustrationdate',
    'label': 'dargestelltes Jahr',
    'sort': 301
  },
  {
    'property': 'istg:colored',
    'label': 'Farbe',
    'sort': 303
  },
  {
    'property': 'istg:technic',
    'label': 'Technik',
    'sort': 305
  },
  {
    'property': 'istg:badCondition',
    'label': 'Schlechter zusatnd',
    'sort': 306
  },
  {
    'property': 'istg:type',
    'label': 'Typ',
    'sort': 307
  },
  {
    'property': 'istg:politicalBoundaries',
    'label': 'Politische Grenzen',
    'sort': 310
  },
  {
    'property': 'istg:churchBoundaries',
    'label': 'Kirchliche Grenzen',
    'sort': 311
  },
  {
    'property': 'istg:relief',
    'label': 'Geländestrukturen',
    'sort': 312
  },
  {
    'property': 'istg:cityBlockRepresentation',
    'label': 'Baublöcke',
    'sort': 313
  },
  {
    'property': 'istg:parcelRepresentation',
    'label': 'Parzellen',
    'sort': 314
  },
  {
    'property': 'istg:streetNames',
    'label': 'Straßennamen',
    'sort': 315
  },
  {
    'property': 'istg:houseNumbers',
    'label': 'Hausnummern',
    'sort': 316
  },
  {
    'property': 'istg:streetDirectory',
    'label': 'Straßenverzeichnis',
    'sort': 317
  },
  {
    'property': 'foaf:depiction',
    'label': 'Vollansicht',
    'sort': 320
  },
  {
    'property': 'istg:printedFront',
    'label': 'Vorderseite gedruckt',
    'sort': 410
  },
  {
    'property': 'dc:contributor',
    'label': 'Fotograf',
    'sort': 409
  },
  {
    'property': 'istg:handwritingFront',
    'label': 'Vorderseite handschriftlich',
    'sort': 411
  },
  {
    'property': 'istg:printedBack',
    'label': 'Rückseite gedruckt',
    'sort': 412
  },
  {
    'property': 'istg:handwritingBack',
    'label': 'Rückseite handschriftlich',
    'sort': 413
  },
  {
    'property': 'istg:color',
    'label': 'Farbe/SW',
    'sort': 415
  },
  {
    'property': 'istg:condition',
    'label': 'Erhaltungszustand',
    'sort': 416
  },
  {
    'property': 'istg:continent',
    'label': 'Kontinent',
    'sort': 10
  },
  {
    'property': 'istg:country',
    'label': 'Staat',
    'sort': 11
  },
  {
    'property': 'istg:state',
    'label': 'Bundesland',
    'sort': 12
  },
  {
    'property': 'istg:city',
    'label': 'Stadt',
    'sort': 13
  },
  {
    'property': 'istg:region',
    'label': 'Region',
    'sort': 14
  },
  {
    'property': 'istg:landkreis',
    'label': 'Landkreis',
    'sort': 15
  },
  {
    'property': 'gn:name',
    'label': 'Stadt',
    'sort': 504
  },
  {
    'property': 'istg:cityDistrict',
    'label': 'Stadtteil',
    'sort': 505
  },
  {
    'property': 'istg:urbanDistrict',
    'label': 'Stadt',
    'sort': 506
  },
  {
    'property': 'istg:postcode',
    'label': 'Postleitzahl',
    'sort': 507
  },
  {
    'property': 'istg:historicalLocation',
    'label': 'Historische Lage',
    'sort': 508
  },
  {
    'property': 'rdfs:comment',
    'label': 'Kommentar',
    'sort': 600
  },
  {
    'property': 'dc:subject',
    'label': 'Schlagworte',
    'sort': 601
  },
  {
    'property': 'dct:subject',
    'label': 'Schlagworte',
    'sort': 601
  },
  {
    'property': 'istg:signatur',
    'label': 'Signatur',
    'sort': 602
  },
  {
    'property': 'istg:library',
    'label': 'Signatur',
    'sort': 602
  },
  {
    'property': 'istg:inventory',
    'label': 'Inventurnummer',
    'sort': 602
  },
  {
    'property': 'foaf:thumbnail',
    'label': 'Vorschaubild',
    'sort': 99999
  }
];