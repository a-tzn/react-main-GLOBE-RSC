export function cleanText(str) {
  if (!str) return "";
  return String(str)
    .toUpperCase()
    .replace(/\s+/g, " ")   // replace all kinds of whitespace with normal space
    .replace(/\u00A0/g, " ") // replace non-breaking spaces
    .trim();
}

export function dict(prov) {
  if (!prov) return "";
  prov = cleanText(prov);

  const regions = {
    "REGION IX (ZAMBOANGA PENINSULA)": [
      "ZAMBOANGA DEL NORTE",
      "ZAMBOANGA DEL SUR",
      "ZAMBOANGA SIBUGAY"
    ],
    "REGION X (NORTHERN MINDANAO)": [
      "BUKIDNON",
      "CAMIGUIN",
      "LANAO DEL NORTE",
      "MISAMIS OCCIDENTAL",
      "MISAMIS ORIENTAL"
    ],
    "REGION XI (DAVAO REGION)": [
      "DAVAO DE ORO",
      "DAVAO DEL NORTE",
      "DAVAO DEL SUR",
      "DAVAO OCCIDENTAL",
      "DAVAO ORIENTAL",
      "COMPOSTELA VALLEY"
    ],
    "REGION XII (SOCCSKSARGEN)": [
      "COTABATO",
      "SARANGANI",
      "SOUTH COTABATO",
      "SULTAN KUDARAT",
      "NORTH COTABATO"
    ],
    "REGION XIII (CARAGA)": [
      "AGUSAN DEL NORTE",
      "AGUSAN DEL SUR",
      "DINAGAT ISLANDS",
      "SURIGAO DEL NORTE",
      "SURIGAO DEL SUR",
      "DINAGAT ISLAND"
    ],
    "BARMM (BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO)": [
      "BASILAN",
      "LANAO DEL SUR",
      "MAGUINDANAO DEL NORTE",
      "MAGUINDANAO DEL SUR",
      "MAGUINDANAO",
      "SULU",
      "TAWI TAWI"
    ]
  };

  for (const [reg, pro] of Object.entries(regions)) {
    for (const p of pro) {
      if (p === prov) {
        return reg;
      }
    }
  }

  return "";
}

export function towerC(twr) {
  if (!twr) return "";

  const towerCompanies = {
    "TCFGA": "FTAP",
    "TCPHT": "PTCI",
    "TCAIC": "UNITY",
    "TCCRE": "CREI",
    "TCDT":"DT",
    "TCLDC": "LDIC",
    "TCAG": "ATC",
    "TCEDC": "EDOTCO",
    "TCIS": "ISON",
    "TCSBA": "SBA",
    "TCTI": "TIGER"
  };

  const twrUpper = String(twr).toUpperCase();
  for (const [twrCode, owner] of Object.entries(towerCompanies)) {
    if (twrUpper.includes(twrCode)) return owner;
  }

  return "";
}

export function provinceNew(prov) {
  if (!prov) return "";

  var name = String(prov).toUpperCase();

  var provMap = [
    { keys: ["DVOC"], prov: "DAVAO OCCIDENTAL" },
    { keys: ["DVOR"], prov: "DAVAO ORIENTAL" },
    { keys: ["MISOR", "MOR"], prov: "MISAMIS ORIENTAL" },
    { keys: ["MOCC", "MOC"], prov: "MISAMIS OCCIDENTAL" },
    { keys: ["DNGT"], prov: "DINAGAT ISLANDS" },
    { keys: ["CMGN"], prov: "CAMIGUIN" },
    { keys: ["ZSIB"], prov: "ZAMBOANGA SIBUGAY" },
    { keys: ["ZDN"], prov: "ZAMBOANGA DEL NORTE" },
    { keys: ["ZDS"], prov: "ZAMBOANGA DEL SUR" },
    { keys: ["LDN"], prov: "LANAO DEL NORTE" },
    { keys: ["LDS"], prov: "LANAO DEL SUR" },
    { keys: ["MGDN", "MGND"], prov: "MAGUINDANAO" },
    { keys: ["SCOT"], prov: "SOUTH COTABATO" },
    { keys: ["NCOT", "COT"], prov: "NORTH COTABATO" },
    { keys: ["SAR"], prov: "SARANGANI" },
    { keys: ["AGN"], prov: "AGUSAN DEL NORTE" },
    { keys: ["AGS"], prov: "AGUSAN DEL SUR" },
    { keys: ["SDN"], prov: "SURIGAO DEL NORTE" },
    { keys: ["SDS"], prov: "SURIGAO DEL SUR" },
    { keys: ["BUK"], prov: "BUKIDNON" },
    { keys: ["DDO"], prov: "DAVAO DE ORO" },
    { keys: ["CVLY"], prov: "COMPOSTELA VALLEY" },
    { keys: ["DDN"], prov: "DAVAO DEL NORTE" },
    { keys: ["DDS"], prov: "DAVAO DEL SUR" },
    { keys: ["BAS"], prov: "BASILAN" },
    { keys: ["SULU"], prov: "SULU" },
    { keys: ["TAWI"], prov: "TAWI TAWI" },
    { keys: ["SKUD"], prov: "SULTAN KUDARAT" }
  ];

  var bestMatch = "";
  var bestPos = -1;

  for (var i = 0; i < provMap.length; i++) {
    for (var j = 0; j < provMap[i].keys.length; j++) {
      var key = provMap[i].keys[j];
      var pos = name.lastIndexOf(key);
      if (pos > bestPos) {
        bestPos = pos;
        bestMatch = provMap[i].prov;
      }
    }
  }

  return bestMatch;
}

export function cityNew(city) {
  if (!city) return "";

  var ct = String(city).toUpperCase();

  var cityMap = [
    { keys: ["MKLALA"], city: "MAKILALA" },
    { keys: ["PANABO"], city: "PANABO CITY" },
    { keys: ["TAGUM"], city: "TAGUM CITY" },
    { keys: ["DIGOS"], city: "DIGOS CITY" },
    { keys: ["GENSAN", "GEN"], city: "GENERAL SANTOS CITY" },
    { keys: ["ZAMBOA"], city: "ZAMBOANGA CITY" },
    { keys: ["POLOMO"], city: "POLOMOLOK" },
    { keys: ["MRAMAG", "MARAM"], city: "MARAMAG" },
    { keys: ["KIDAP"], city: "KIDAPAWAN CITY" },
    { keys: ["COTAB"], city: "COTABATO CITY" },
    { keys: ["ISBELA"], city: "ISABELA CITY" },
    { keys: ["MATI"], city: "MATI CITY" },
    { keys: ["GINGOO"], city: "GINGOOG CITY" },
    { keys: ["LAGUIN"], city: "LAGUINDINGAN" },
    { keys: ["DIPOL", "DPOLOG"], city: "DIPOLOG CITY" },
    { keys: ["DINAIG"], city: "DATU ODIN SINSUAT" },
    { keys: ["TLIPAO"], city: "TALIPAO" },
    { keys: ["PIKIT"], city: "PIKIT" },
    { keys: ["BANGA"], city: "BANGA" },
    { keys: ["LEBAK"], city: "LEBAK" },
    { keys: ["NASIP"], city: "NASIPIT" },
    { keys: ["SIASI"], city: "SIASI" },
    { keys: ["MGALAN"], city: "MAGALLANES" },
    { keys: ["LUTYN"], city: "LUTAYAN" },
    { keys: ["KNADAL"], city: "KORONADAL CITY" },
    { keys: ["SURALL"], city: "SURALLAH" },
    { keys: ["SNJOSE"], city: "SAN JOSE" },
    { keys: ["MDALUM"], city: "MADALUM" },
    { keys: ["NORALA"], city: "NORALA" },
    { keys: ["BARIRA"], city: "BARIRA" },
    { keys: ["SIBUTU"], city: "SIBUTU" },
    { keys: ["TALAKAG"], city: "TALAKAG" },
    { keys: ["PTIKUL"], city: "PATIKUL" },
    { keys: ["INDANA"], city: "INDANAN" },
    { keys: ["PARANG"], city: "PARANG" },
    { keys: ["MAASIM"], city: "MAASIM" },
    { keys: ["SNFERN"], city: "SAN FERNANDO" },
    { keys: ["LAMITN"], city: "LAMITAN CITY" },
    { keys: ["KBACAN"], city: "KABACAN" },
    { keys: ["ALEOSN"], city: "ALEOSAN" },
    { keys: ["BULUAN"], city: "BULUAN" },
    { keys: ["BAGUMB"], city: "BAGUMBAYAN" },
    { keys: ["DCARLS"], city: "DON CARLOS" },
    { keys: ["PIANG"], city: "DATU PIANG" },
    { keys: ["KITAO"], city: "KITAOTAO" },
    { keys: ["LNIEV"], city: "LAS NIEVES" },
    { keys: ["MAMBAJA", "MAMBJA"], city: "MAMBAJAO" },
    { keys: ["LABANG"], city: "LABANGAN" },
    { keys: ["NINO"], city: "SANTO NINO" },
    { keys: ["VRUELA"], city: "VERUELA" },
    { keys: ["NULING"], city: "NULING" },
    { keys: ["CAGDIA"], city: "CAGDIANAO" },
    { keys: ["BANSLN"], city: "BANSALAN" },
    { keys: ["LANTAW"], city: "LANTAWAN" },
    { keys: ["TAGO"], city: "TAGO" },
    { keys: ["TUBOD"], city: "TUBOD" },
    { keys: ["BALOI"], city: "BALOI" },
    { keys: ["PNGANT"], city: "PANGANTUCAN" },
    { keys: ["KIAMBA"], city: "KIAMBA" },
    { keys: ["TAGOLO"], city: "TAGOLOAN" },
    { keys: ["BLABAG"], city: "BALABAGAN" },
    { keys: ["KAPAI"], city: "KAPAI" },
    { keys: ["MARGOS"], city: "MARGOSATUBIG" },
    { keys: ["BAGANG"], city: "BAGANGA" },
    { keys: ["OZAMIS", "OZM"], city: "OZAMIZ CITY" },
    { keys: ["ILIGAN"], city: "ILIGAN CITY" },
    { keys: ["MARAWI"], city: "MARAWI CITY" },
    { keys: ["BUTUAN"], city: "BUTUAN CITY" },
    { keys: ["CARMEN"], city: "CARMEN" },
    { keys: ["STOMAS"], city: "SANTO TOMAS" },
    { keys: ["KPALON"], city: "KAPALONG" },
    { keys: ["SAMAL"], city: "ISLAND GARDEN CITY OF SAMAL" },
    { keys: ["PANTUK"], city: "PANTUKAN" },
    { keys: ["MACO"], city: "MACO" },
    { keys: ["MALITA"], city: "MALITA" },
    { keys: ["BANSAL"], city: "BANSALAN" },
    { keys: ["PADADA"], city: "PADADA" },
    { keys: ["SULOP"], city: "SULOP" },
    { keys: ["SMARIA"], city: "SANTA MARIA" },
    { keys: ["GLAN"], city: "GLAN" },
    { keys: ["ALABEL"], city: "ALABEL" },
    { keys: ["MALAPAT", "MLAPAT"], city: "MALAPATAN" },
    { keys: ["SFRANC"], city: "SAN FRANCISCO" },
    { keys: ["MIDSAY"], city: "MIDSAYAP" },
    { keys: ["SFERN"], city: "SAN FERNANDO" },
    { keys: ["PGDIAN"], city: "PAGADIAN CITY" },
    { keys: ["MFORT", "MANFOR"], city: "MANOLO FORTICH" },
    { keys: ["TACUROS", "TACURO"], city: "TACURONG CITY" },
    { keys: ["BISLIG"], city: "BISLIG CITY" },
    { keys: ["CLAVER"], city: "CLAVER" },
    { keys: ["BAYABS"], city: "BAYABAS" },
    { keys: ["DAVAO"], city: "DAVAO CITY" },
    { keys: ["CDO"], city: "CAGAYAN DE ORO CITY" },
    { keys: ["MTALAM"], city: "MATALAM" },
    { keys: ["SANGKI"], city: "DATU ABDULLAH SANGKI" },
    { keys: ["SAUDIA"], city: "DATU SAUDI-AMPATUAN" },
    { keys: ["SURGAO"], city: "SURIGAO CITY" },
    { keys: ["MARAGU"], city: "MARAGUSAN" },
    { keys: ["NABUN"], city: "NABUNTURAN" },
    { keys: ["MONTEV"], city: "MONTEVISTA" },
    { keys: ["MAWAB"], city: "MAWAB" },
    { keys: ["MABINI"], city: "MABINI" },
    { keys: ["COMPOS"], city: "COMPOSTELA" },
    { keys: ["MALAYB"], city: "MALAYBALAY CITY" },
    { keys: ["JOLO"], city: "JOLO" },
    { keys: ["BONGAO"], city: "BONGAO" },
    { keys: ["LUPON"], city: "LUPON" },
    { keys: ["TANDAG"], city: "TANDAG CITY" },
    { keys: ["HINATU"], city: "HINATUAN" },
    { keys: ["VALEN"], city: "VALENCIA CITY" },
    { keys: ["MARBE"], city: "MARBEL CITY" },
    { keys: ["MONKAY"], city: "MONKAYO" },
    { keys: ["MLANG"], city: "MLANG" },
    { keys: ["MALABA"], city: "MALABANG" },
    { keys: ["PATKUL"], city: "PATIKUL" },
    { keys: ["LUTAYN"], city: "LUTAYAN" },
    { keys: ["RLIM"], city: "ROSELLER LIM" },
    { keys: ["LILOY"], city: "LILOY" },
    { keys: ["KPATAG"], city: "KAPATAGAN" },
    { keys: ["MAITUM"], city: "MAITUM" },
    { keys: ["MEDINA"], city: "MEDINA" },
    { keys: ["PROSP"], city: "PROSPERIDAD" },
    { keys: ["GLUNA"], city: "GENERAL LUNA" },
    { keys: ["BUBONG"], city: "BUBONG" },
    { keys: ["LILOY"], city: "LILOY" },
    { keys: ["LALA"], city: "LALA" },
    { keys: ["MAGSAY"], city: "MAGSAYSAY" },
    { keys: ["DUMALI"], city: "DUMALINAO" },
    { keys: ["GDULUN"], city: "GUINDULUNGAN" },
    { keys: ["KTIPUN"], city: "KATIPUNAN" },
    { keys: ["ELSALV"], city: "EL SALVADOR CITY" },
    { keys: ["TANGUIB"], city: "TANGUB CITY" },
    { keys: ["DPITAN"], city: "DAPITAN CITY" },
    { keys: ["DIPLA"], city: "DIPLAHAN" },
    { keys: ["LUMBAY"], city: "LUMBA-BAYABAO" },
    { keys: ["TITAY"], city: "TITAY" },
    { keys: ["LUBIJ"], city: "ALUBIJID" },
    { keys: ["BLINDO"], city: "BALINDONG" },
    { keys: ["TALISA"], city: "TALISAYAN" },
    { keys: ["ALORAN"], city: "ALORAN" },
    { keys: ["PROXAS"], city: "PRESIDENT ROXAS" },
    { keys: ["CLARIN"], city: "CLARIN" },
    { keys: ["KIBLAW"], city: "KIBLAWAN" },
    { keys: ["QUEZON"], city: "QUEZON" },
    { keys: ["SINDAN"], city: "SINDANGAN" },
    { keys: ["SNACAB"], city: "SINACABAN" },
    { keys: ["INITAO"], city: "INITAO" },
    { keys: ["MHINOG"], city: "MAHINOG" },
    { keys: ["OPOL"], city: "OPOL" },
    { keys: ["KOLAMB"], city: "KOLAMBUGAN" },
    { keys: ["TUKURA"], city: "TUKURAN" },
    { keys: ["ALEGRI"], city: "ALEGRIA" },
    { keys: ["LUGUS"], city: "LUGUS" },
    { keys: ["CAGWIT"], city: "CAGWAIT" },
    { keys: ["BCUNGA"], city: "BACUNGAN" },
    { keys: ["PLIMBA"], city: "PALIMBANG" },
    { keys: ["PAYAO"], city: "PAYAO" },
    { keys: ["ISULAN"], city: "ISULAN" },
    { keys: ["MTANAO", "MATANAO"], city: "MATANAO" },
    { keys: ["LINGIG"], city: "LINGIG" },
    { keys: ["BARONG"], city: "SULTAN SA BARONGIS" },
    { keys: ["BASILI"], city: "BASILISA" },
    { keys: ["STCRUZ"], city: "SANTA CRUZ" },
    { keys: ["BUTIG"], city: "BUTIG" },
    { keys: ["ROSAR"], city: "ROSARIO" },
    { keys: ["TIGBAO"], city: "TIGBAO" },
    { keys: ["LIARGO"], city: "RAMON MAGSAYSAY" },
    { keys: ["PIAGAP"], city: "PIAGAPO" },
    { keys: ["MLALAG"], city: "MALALAG" },
    { keys: ["AQUINO"], city: "MUNICIPALITY OF SENATOR NINOY AQUINO" },
    { keys: ["BATAN"], city: "NEW BATAAN" },
    { keys: ["JABAD"], city: "JOSE ABAD SANTOS" },
    { keys: ["BULDON"], city: "BULDON" },
    { keys: ["LNAMON"], city: "LINAMON" },
    { keys: ["MOLAVE"], city: "MOLAVE" },
    { keys: ["TANTAN"], city: "TANTANGAN" },
    { keys: ["MALUNG"], city: "MALUNGON" },
    { keys: ["BUENV"], city: "BUENAVISTA" },
    { keys: ["ANTPAS"], city: "ANTIPAS" },
    { keys: ["BANISL", "BANI"], city: "BANISILAN" },
    { keys: ["BANAY"], city: "BANAYBANAY" },
    { keys: ["SUMSIP"], city: "SUMISIP" },
    { keys: ["ARAKAN"], city: "ARAKAN" },
    { keys: ["KOLAMB"], city: "KOLAMBUGAN" },
    { keys: ["JASAAN"], city: "JASAAN" },
    { keys: ["KLAWIT"], city: "KALAWIT" },
    { keys: ["GUINSI"], city: "GUINSILIBAN" },
    { keys: ["POLANC"], city: "POLANCO" },
    { keys: ["SLVDOR"], city: "SALVADOR" },
    { keys: ["OROQUI"], city: "OROQUIETA CITY" },
    { keys: ["MANTIC"], city: "MANTICAO" },
    { keys: ["BLINDO"], city: "BALINDONG" },
    { keys: ["PATKUL"], city: "PATIKUL" },
    { keys: ["BUUG"], city: "BUUG" },
    { keys: ["PIGKAW"], city: "PIGKAWAYAN" },
    { keys: ["SNTGO"], city: "SANTIAGO" },
    { keys: ["TUBAY"], city: "TUBAY" },
    { keys: ["SMENA"], city: "MUNICIPALITY OF SERGIO OSMENA SR." },
    { keys: ["ANTPAS"], city: "ANTIPAS" },
    { keys: ["BCUNGA"], city: "BACUNGAN" },
    { keys: ["CARAGA"], city: "CARAGA" },
    { keys: ["CONCEP"], city: "CONCEPCION" },
    { keys: ["BONIFA"], city: "BONIFACIO" },
    { keys: ["MLALAG"], city: "MALALAG" },
    { keys: ["TARRA"], city: "TARRAGONA" },
    { keys: ["SIAY"], city: "SIAY" },
    { keys: ["BUNAW"], city: "BUNAWAN" },
    { keys: ["LIBONA"], city: "LIBONA" },
    { keys: ["DAPITA"], city: "DAPITAN CITY" },
    { keys: ["BCOLOD"], city: "BACOLOD" },
    { keys: ["CLAMBA"], city: "CALAMBA" },
    { keys: ["DINAS"], city: "DINAS" },
    { keys: ["ESPER"], city: "ESPERANZA" },
    { keys: ["LJAENA"], city: "LOPEZ JAENA" },
    { keys: ["BUMBAR"], city: "AMAI MANABILANG" },
    { keys: ["IMELDA", "MELDA"], city: "IMELDA" },
    { keys: ["LBERTD"], city: "LIBERTAD" },
    { keys: ["PLARID"], city: "PLARIDEL" },
    { keys: ["IMPAS"], city: "IMPASUG-ONG" },
    { keys: ["SITANG"], city: "SITANGKAI" },
    { keys: ["SALAY"], city: "SALAY" },
    { keys: ["TRENTO"], city: "TRENTO" },
    { keys: ["TGOLOA"], city: "TAGOLOAN" },
    { keys: ["TAMPAK"], city: "TAMPAKAN" },
    { keys: ["ALMADA"], city: "ALAMADA" },
    { keys: ["LAAK"], city: "LAAK" },
    { keys: ["CHIONG"], city: "MUNICIPALTIY OF DON VICTORIANO CHIONGBIAN" },
    { keys: ["TUNGAW"], city: "TUNGAWAN" },
    { keys: ["NAGA"], city: "NAGA" },
    { keys: ["SAGUIA"], city: "SAGUIARAN" },
    { keys: ["IPIL"], city: "IPIL" },
    { keys: ["HGONOY"], city: "HAGONOY" },
    { keys: ["KUMALA"], city: "KUMALARANG" },
    { keys: ["GUIPOS"], city: "GUIPOS" },
    { keys: ["LAMBAY"], city: "LAMBAYONG" },
    { keys: ["MBUHAY"], city: "MABUHAY" },
    { keys: ["SOMNOT"], city: "SOMINOT" },
    { keys: ["TABINA"], city: "TABINA" },
    { keys: ["LPUYAN"], city: "LAPUYAN" },
    { keys: ["LWOOD"], city: "LAKEWOOD" },
    { keys: ["PANTAR"], city: "PANTAR" },
    { keys: ["PRAGAT"], city: "PANTAO RAGAT" },
    { keys: ["MARIA"], city: "SANTA MARIA" },
    { keys: ["SALUG"], city: "SALUG" },
    { keys: ["SISON"], city: "SISON" },
    { keys: ["SARANGG"], city: "SARANGANI" },
    { keys: ["SDLAGA"], city: "SAPANG DALAGA" },
    { keys: ["TAGBINA"], city: "TAGBINA" },
    { keys: ["TUMBAO"], city: "KABUNTALAN" },
    { keys: ["KINOG"], city: "KINOGUITAN" },
    { keys: ["DANGCA"], city: "DANGCAGAN" },
    { keys: ["LBERTD"], city: "LIBERTAD" },
    { keys: ["LUGAIT"], city: "LUGAIT" },
    { keys: ["BINIDA"], city: "BINIDAYAN" },
    { keys: ["LINAMO"], city: "LINAMON" },
    { keys: ["GUTALC"], city: "GUTALAC" },
    { keys: ["ISIDRO"], city: "SAN ISIDRO" },
    { keys: ["PANGUT"], city: "PANGUTARAN" },
    { keys: ["LIBUNG"], city: "LIBUNGAN" },
    { keys: ["DUMING"], city: "DUMINGAG" },
    { keys: ["BAYUG"], city: "BAYUGAN CITY" },
    { keys: ["TUNGAW"], city: "TUNGAWAN" },
    { keys: ["MLUSO"], city: "MALUSO" },
    { keys: ["SIAYAN"], city: "SIAYAN" },
    { keys: ["LANUZA"], city: "LANUZA" },
    { keys: ["JMENEZ"], city: "JIMENEZ" },
    { keys: ["IMPAS"], city: "IMPASUGONG" },
    { keys: ["DRAMAI"], city: "DITSAAN-RAMAIN" },
    { keys: ["MARANT"], city: "MARANTAO" },
    { keys: ["MAIMBU"], city: "MAIMBUNG" },
    { keys: ["SAPA"], city: "SAPA-SAPA" },
    { keys: ["POONAB"], city: "POONA BAYABAO" },
    { keys: ["HADJMU"], city: "HADJI MUHTAMAD" },
    { keys: ["GANASI"], city: "GANASSI" },
    { keys: ["SIMNUL"], city: "SIMUNUL" },
    { keys: ["LAAK"], city: "LAAK" },
    { keys: ["DANGCA"], city: "DANGCAGAN" },
    { keys: ["SALUG"], city: "SALUG" },
    { keys: ["CATARM"], city: "CATARMAN" },
    { keys: ["TLAKAG"], city: "TALAKAG" },
    { keys: ["MSALIP"], city: "MIDSALIP" },
    { keys: ["KBASAL"], city: "KABASALAN" },
    { keys: ["GODOD"], city: "GODOD" },
    { keys: ["SUMLAO"], city: "SUMILAO" },
    { keys: ["INTAO"], city: "INTAO" },
    { keys: ["KIBAWE"], city: "KIBAWE" },
    { keys: ["BLINGO"], city: "BALINGOAN" },
    { keys: ["MASTUR"], city: "MUNICIPALITY OF SULTAN MASTURA" },
    { keys: ["ALMADA"], city: "ALAMADA" },
    { keys: ["KALILNGN"], city: "KALILANGAN" },
    { keys: ["SUGBON"], city: "SUGBONGCOGON" },
    { keys: ["UPI"], city: "UPI" },
    { keys: ["MHAYAG"], city: "MAHAYAG" },
    { keys: ["DMULOG"], city: "DA MULOG" },
    { keys: ["AURORA"], city: "AURORA" },
    { keys: ["IMPAS"], city: "IMPASUGONG" },
    { keys: ["LAGONG"], city: "LAGONGLONG" },
    { keys: ["NAAWAN"], city: "NAAWAN" },
    { keys: ["SBUTAD"], city: "SIBUTAD" },
    { keys: ["PICONG"], city: "PICONG" },
    { keys: ["DNAGAT"], city: "DINAGAT" },
    { keys: ["KABACAN"], city: "KABACAN" }
  ];

  var bestIndex = -1;
  var bestCity = "";

  for (var i = 0; i < cityMap.length; i++) {
    for (var j = 0; j < cityMap[i].keys.length; j++) {
      var key = cityMap[i].keys[j];
      var idx = ct.indexOf(key);
      if (idx !== -1 && idx > bestIndex) {
        bestIndex = idx;
        bestCity = cityMap[i].city;
      }
    }
  }

  return bestCity;
}
