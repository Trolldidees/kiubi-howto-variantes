/** 
 * Kiubi API - variantes multi-critères
 * 
 * Copyright 2013 Troll d'idees
 */

(function($){

// Cache contenant les données des variantes de produit.
// La clé de chaque éléments de cet objet est l'identifiant numérique
// de la variante de produit. Ce cache est mis à jour par la méthode
// jQuery.fn.variantes_multicriteres
var variants_data = {};

// Cache contenant le nom des critères pour un type produit donné.
// La clé de chaque éléments de cet objet est le nom du type de produit.
// Ce cache est mis à jour par la méthode jQuery.fn.variantes_multicriteres
var variants_labels = {};

/**
 * Décompose un objet uni-dimensionnel (selon sa clé
 * et un délimiteur) en objet mutli-dimensionnel
 * 
 * exemple :
 * data = {
 *     'a1|b1|c1' : 111,
 *     'a1|b1|c2' : 112,
 *     'a1|b2|c1' : 121,
 *     'a1|b3' : 13,
 *     'a1|b2|c4' : 124,
 *     'a2|b1|c1' : 211,
 *     'a2|b2|c4' : 224,
 *     'a3' : 3
 * }
 * data = decompose(data,'|');
 * data vaut désormais :
 * {
 *     'a1' : {
 *         'b1' : {
 *             'c1' : 111,
 *             'c2' : 112 },
 *         'b2' : {
 *             'c1' : 121,
 *             'c4' : 124 },
 *         'b3' : 13 },
 *     'a2' : {
 *	       'b1' : { c1 : 211 },
 *	       'b2' : { c4 : 224 } },
 *	   'a3' : 3
 * }
 * 
 * @param data Object
 * @param delimiter String
 * @return Object
 */
var decompose = function(data, delimiter)
{        
	var recursive = false;
	var _data = {};

	$.each(data, function(key, value) {
		var _value = {}; _value[key] = value;
		var index = key.lastIndexOf(delimiter);

		if(index > 0) {
			recursive = (recursive || key.indexOf(delimiter) < index);
			// recursive determine si il restera au moins  
			// encore une clé à décomposer

			var sub_key = key.substr(index+1);
			key = key.substr(0, index);

			_value = {};
			_value[key] = {};
			_value[key][sub_key] = value;
		}
		if(typeof _data[key] != "undefined") {
			// une clé existe déjà, on realise un deep extends
			_data = $.extend(true, _data, _value);
		}
		else {
			_data[key] = _value[key];
		}
	});

	return recursive ? decompose(_data, delimiter) : _data;			
}

/**
 * Génère une liste déroulante en fonction des données passées en argument.
 * 
 * @param object data Critère de variante
 * @param jQuery $container Objet jQuery correspondant au conteneur 
 *     dans lequel sera ajouté la liste déroulante
 * @param array labels Liste des labels des critères
 * @param integer depth = 0 Niveau de profondeur de la liste déroulante à
 *     générer
 * @return void
 */
var dropdown = function(data, $container, labels, depth){

	depth = parseInt(depth || 0);

	var criterion = $('<span>')
		.addClass('criterion')
		.data('depth', depth)
		.appendTo($container);

	// optionnel : on ajoute un label devant la liste déroulante
	$('<span>').html(labels[depth]).appendTo(criterion);
	
	var $select = $('<select>').appendTo(criterion);

	// optionnel : on ajoute le label dans la liste déroulante
	// $('<option>',{disabled:true,selected:true,text:labels[depth]}).appendTo($select);
	
	$.each(data, function(key, value){
		var option = $('<option>', {html:key});
		// on stock la liste des sous-option, ou l'identifiant de 
		// variante dans l'élément <option>
		option.data('value', value);
		option.appendTo($select);
	});

	$select.change(function(){

		var depth = $(this).parent().data('depth');

		$.each($(".criterion", $container),function(){
			if($(this).data('depth') > depth) $(this).remove();
		})
		// on récupère les sous-options, ou l'identifiant de 
		// variante de l'option courante
		var value = $('option:selected', this).data('value');
		
		// on récupère, ou on génère au besoin, un champs masqué qui
		// contiendra la variante_id
		var $result = $('input[name=vid]', $container);
		if(!$result.length) {
			$result = $("<input>", {type:"hidden", name:'vid'}).appendTo($container);
		}

		if(typeof value == "object") {
			// la valeur est une liste de sous option
			// on génère une nouvelle liste déroulante avec ces valeurs
			dropdown(value, $container, labels, depth + 1);
		}
		else if(value) {
			// la valeur est un identifiant de variante,
			// on met à jour le prix, on affiche le bouton ajouter
			// au panier, et on met à jour la valeur du champs masqué vid
			$('.price', $container.parent()).html(variants_data[value].price_inc_vat_label);
			$('.ajout_panier', $container.parent()).show();
			$result.val(value);
		}
		else {
			// l'élement n'a pas de valeur, (on a potentiellement choisi 
			// d'afficher un label DANS la liste déroulante, et ce label
			// est actuellement selectionné)
			$('.price', $container.parent()).empty();
			$('.ajout_panier', $container.parent()).hide();
			$result.val("");
		}
	});
	
	// force le chargement des sous-options
	$select.change();
}

$.fn.variantes_multicriteres = function(product) {
	// Construction du cache variants_labels[product.type]
	if(typeof variants_labels[product.type] == "undefined") {
		
		variants_labels[product.type] = false;
		
		// Lecture du fichier de configuration du type de produit
		var config_reader = $.ajax({
			url : '/theme/fr/produits/' + product.type + '/config.xml',
			dataType : 'xml',
			async : false
		});
		
		config_reader.done(function(config){
			var criteres = $('extra critere', config);
			// si aucun critère n'est défini pour ce type de produit
			// on abandone, false sera mis en cache.
			if(!criteres.length) return; 
			
			// un ou plusieur critère on été trouvé
			variants_labels[product.type] = [];
			$.each(criteres, function(){
				variants_labels[product.type].push($(this).text());
			});
		});
	}
	
	var $container = this;
	var labels = variants_labels[product.type];
	
	// Ce type de produit ne possède aucun critère. On return.
	if(labels === false) return this;
	
	//var product_id = product.id;
	var variants = {};

	$.each(product.variants, function(num, variant){
		// on choisit de ne pas afficher les variantes non disponibles
		if(!variant.is_available) return; 
		// on compose le tableau associatif
		// nom de la variante => identifiant unique de la variante
		variants[variant.name] = variant.id;
		variants_data[variant.id] = variant;
	});

	// on décompose cet objet selon le séparateur "|"
	variants = decompose(variants, "|");

	/**
	 * variants contient desormais un "tableau" 
	 * multi-dimensionnel sous la forme :
	 * 
	 * variants = {
	 * 	 critere1_valeur1 : {
	 * 	   critere2_valeur1 : {
	 * 	     critere3_valeur1 : id,
	 * 	     critere3_valeur2 : id,
	 * 	     critere3_valeur3 : id,
	 * 	   },
	 * 	   critere2_valeur2 : {
	 * 	     critere3_valeur1 : id,
	 * 	     critere3_valeur4 : id,
	 * 	   }
	 * 	 },
	 * 	 critere1_valeur2 : {
	 * 	   ...
	 * 	 }
	 * }
	 */

	// on vide le conteneur ul.variants
	$container.empty();
	
	// on génère les dropdowns correspondants aux différents critère
	dropdown(variants, $container, labels);
	
	// On ajoute un div qui contiendra le prix en fonction des options choisies
	$('<div class="price">').insertAfter($container);
	
	// On simule l'évenement change sur la derniere 
	// sous-option pour forcer la mise à jour du prix.
	$('select:last', $container).change();
	
	return this;
};

})(jQuery);