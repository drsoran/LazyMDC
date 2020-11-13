/******************************************************************************
* Functions
******************************************************************************/

mission_airfields = {}

function generate_mission_airfields() {

  // When we change the mission_airfields we want to regenerate the waypoints /
  // airfields (carrier additions) 
  
  var theatre = $('#data-theatre').val();
  var mission = $('#data-mission').val();

  if (!mission_data.hasOwnProperty(mission) || !mission_data[mission].hasOwnProperty('airfields')) {
    mission_airfields = theatres[theatre]['airfields'];
    return;
  }

  mission_airfields = jQuery.extend(true, {}, theatres[theatre]['airfields'])

  for (const [key, value] of Object.entries(mission_data[mission]['airfields'])) {
    if (mission_airfields.hasOwnProperty(key)) {
      jQuery.extend(true, mission_airfields[key], value);
    } else {
      mission_airfields[key] = jQuery.extend(true, {}, value);
    }
  };

}

function data_process_kml(xml) {

  // Reset / Present the route dialog
  var select_wp = $("#data-route-dialog-waypoints");
  var select_poi = $("#data-route-dialog-poi");

  $('#data-route-dialog-cf').hide();
  $('#data-route-dialog-ge').show();
  $('#data-route-dialog-cf-only').hide();

  // Reset the form to wipe out any previous routes (first option = None)
  select_wp.children('option:not(:first)').remove();
  select_poi.children('option:not(:first)').remove();

  // Build up a list of routes / store against their names so we can 
  var route_data = new Object(); 

  var nsResolver = xml_createNSResolver(xml)
  var routes = document.evaluate(
    '//kml:Placemark[kml:LineString]', xml,
    nsResolver,
    XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null)

  // We use Placemarks that have LineStrings
  var node;
  while(node = routes.iterateNext()) {

    var title = node.querySelector('name').textContent;
    var name = title;
    var dupe = 0;
    while(route_data[name] !== undefined) {
      dupe++;
      name = title + dupe
    }

    // Store so we can fire the event
    route_data[name] = {
      xml: node,
      xml_format: 'ge',
    }

    // Add options to route selector
    var opt = new Option(title, name)

    select_wp.append(opt);
    select_poi.append(new Option(title, name));
  }

  // Bind our routes to the dialog, and show
  $('#data-route-dialog')
    .data({
      'routes': route_data,
      'xml': xml,
    })
    .modal({
      backdrop: 'static',
  });

}

function data_process_cf(xml) {

  // Reset / Present the route dialog
  var select_wp = $("#data-route-dialog-waypoints");
  var select_poi = $("#data-route-dialog-poi");
  
  $('#data-route-dialog-cf').show();
  $('#data-route-dialog-ge').hide();
  $('#data-route-dialog-cf-only').show();

  // Reset the form to wipe out any previous routes (first option = None)
  select_wp.children('option:not(:first)').remove();
  select_poi.children('option:not(:first)').remove();

  // Build up a list of routes / store against their names so we can 
  var route_data = new Object(); 

  var routes = xml.getElementsByTagName("Route")

  // Iterate the routes and collect Name, Task, Side, AC
  for (var i = 0; i < routes.length; i++) {

    var route_xml = routes[i];

    var name = route_xml.querySelector('Name').textContent;
    var task = route_xml.querySelector('Task').textContent;
    var side = route_xml.querySelector('Side').textContent;
    var aircraft = route_xml.querySelector('Aircraft > Type').textContent;
    var aircraft_source = aircraft;

    var load_loadout = true;
    var route_append = "";

    // Choose if we import route only (set AC if possible)
    
    // F-16 Varianats: F-16A, F-16A MLU, F-16C bl.50, F-16C bl.52 F-16C_50
    if (aircraft.startsWith("F-16")) {
      if (aircraft != 'F-16C_50') {
        route_append = " - Select F-16C_50 in CF for loadout";
        load_loadout = false;
      }
      aircraft = "F-16C"

    // F-18C Variants: F/A-18C, FA-18C_hornet
    } else if (aircraft == 'F/A-18C' || aircraft == 'FA-18C_hornet') {
      if (aircraft != 'FA-18C_hornet') {
        route_append = " - Select FA-18C_hornet in CF for loadout";
        load_loadout = false;
      }
      aircraft = "FA-18C"

    // F-14 Variants: F-14A, F-14B
    } else if (aircraft.startsWith("F-14")) {
      if (aircraft != 'F-14B') {
        route_append = " - select F-14B in CF for loadout";
        load_loadout = false;
      }
      aircraft = "F-14B"

    // A-10 Variants: A-10A, A-10C, A-10C_2 (which is same as a10c for this
    // generator)
    } else if (aircraft.startsWith("A-10")) {
      if (!aircraft.startsWith('A-10C')) {
        route_append = " - Select A-10C or A-10C_2 in CF for loadout";
        load_loadout = false;
      }
      aircraft = "A-10C"

    // Anything else 
    } else { 
      route_append = " - unsupported airframe - route only";
      load_loadout = false;
      aircraft = null;
    }

    var units = route_xml.querySelector('Units').textContent;

    var route_title = `[${task}] ${name} ${units}x${aircraft_source}`

    // Store so we can fire the event
    route_data[name] = {
      aircraft: aircraft,
      side: side,
      task: task,
      units: units,
      use_loadout: load_loadout,
      xml: route_xml,
      xml_format: 'cf',
    }

    // Add options to route selector
    var opt = new Option(route_title + route_append, name)
    if (!load_loadout) {
      opt.style.color = '#cc0000'
    }

    select_wp.append(opt);
    select_poi.append(new Option(route_title, name));
  };

  // Bind our routes to the dialog, and show
  $('#data-route-dialog')
    .data({
      'routes': route_data,
      'xml': xml,
    })
    .modal({
      backdrop: 'static',
    });
}

function data_load_file(input) {

  if (input == undefined) {
    return;
  }

  // input will either be js or cf
  var file = input.files[0];
  var file_ext = file.name.split('.').pop();

  if (file_ext == 'json') {
    var fr = new FileReader()
    fr.onload = function(e) {
        var data = JSON.parse(e.target.result);

        // Check if it's version 2
        if (!data.version || data.version != "2.0") {
          alert('This JSON is not compatible');
          return;
        }

        // Populate all the forms 
        load(data)

        // Save as a new page (in case of edits)
        save({
          data: data,
          new_id: true,
          update_id: true,
          force: true,
        })
    }
    fr.readAsText(file);

  } else if (file_ext == 'cf') {
    zip.createReader(new zip.BlobReader(file), function(zipReader) {
      zipReader.getEntries(function(entries) {
        entries.forEach(function(entry) {
          if (entry.filename === "mission.xml") {
            text = entry.getData(new zip.TextWriter(), function(text) {

              // Parse XML
              var parser = new DOMParser();
              var xml = parser.parseFromString(text,"text/xml");

              data_process_cf(xml)

            })
            return
          }
        })
      })
    }, function(message) {
      alert("Failed to load CF: " + message);
    })
  } else if(file_ext == 'kml') {
    // Standard XML 
    var fr = new FileReader()
    fr.onload = function(e) {
        var parser = new DOMParser();
        kmls = e.target.result;
        var xml = parser.parseFromString(e.target.result,"text/xml");
        kml = xml;
        data_process_kml(xml)
    }
    fr.readAsText(file);
  } else if(file_ext == 'kmz') {
    // doc.kml within a Zip File
    zip.createReader(new zip.BlobReader(file), function(zipReader) {
      zipReader.getEntries(function(entries) {
        entries.forEach(function(entry) {
          if (entry.filename === "doc.kml") {
            text = entry.getData(new zip.TextWriter(), function(text) {

              // Parse XML
              var parser = new DOMParser();
              var xml = parser.parseFromString(text,"text/xml");

              data_process_kml(xml)

            })
            return
          }
        })
      })
    }, function(message) {
      alert("Failed to load KMZ: " + message);
    })
  }

  // Replace fileInput so we can retrigger same file
  $(input).val('')
}

/******************************************************************************
* Bindings
******************************************************************************/

$("#data-mission").change(function(e) {

  var mission = $(e.target).val()

  if (mission_data.hasOwnProperty(mission)) {

    // If the mission contains a theatre, update it, and disable theatre
    if (mission_data[mission].theatre) {
      var input_theatre = $('#data-theatre');
      input_theatre.val(mission_data[mission].theatre).change();
      input_theatre.attr('disabled', 'disabled');
    }
    
    // If the mission contains transition / FL info, update set those
    if (mission_data[mission].hasOwnProperty('navdata')) {
      if (mission_data[mission]['navdata'].hasOwnProperty('transition-alt')) {
        $("#waypoints-transition-alt").val(mission_data[mission]['navdata']['transition-alt'])
      }
      if (mission_data[mission]['navdata'].hasOwnProperty('transition-level')) {
        $("#waypoints-transition-level").val(mission_data[mission]['navdata']['transition-level'])
      }
    }

    // Update to the default bullseye for the mission
    // var bulls = mission_data[mission].bullseye ? mission_data[mission].bullseye :
  } else {
    $('#data-theatre').removeAttr('disabled');
  }

});

function data_update_default_bulls() {
  // Try Mission, then theatre
  var mission = $('#data-mission').val()
  var theatre = $('#data-theatre').val()

  var bulls = mission_data[mission] && mission_data[mission]['bullseye'] ?
              mission_data[mission]['bullseye'] : theatres[theatre]['bullseye'];

  $('#waypoints-bullseye-name').val(bulls['label']);
  $('#waypoints-bullseye-lat')[0].setAttribute('data-raw', bulls['lat']);
  $('#waypoints-bullseye-lon')[0].setAttribute('data-raw', bulls['lon']);

}

$('#data-theatre').change(function(e) {
  generate_mission_airfields()
  data_update_default_bulls();
});

$("#data-route-dialog-submit").click(function(e, data) {

  var dialog = $('#data-route-dialog');
  var xml = dialog.data('xml');

  dialog.modal('hide');

  // Store the route on the flight-aircraft
  var mission_route = $('#data-route-dialog-waypoints').val()
  var mission_route_data = mission_route == 'None' ? null : dialog.data('routes')[mission_route];

  if (mission_route_data) {
    // If we have unchecked the use-loadout checkbox, update our mission route data and submit
    if (!$("#data-route-dialog-use-loadout").is(':checked')) {
      mission_route_data.use_loadout = false;
    }

    // Store we have waypoint style; store it
    var wp_style = $("#data-route-dialog input[name=data-route-dialog-wp-style]:checked").val();
    if (wp_style) {
      mission_route_data.wp_style = wp_style;
    }
  }

  // Update airframe value
  $('#flight-airframe').data('route', mission_route_data).trigger('data-route-updated');

  // Store the route for poi
  var poi_route = $('#data-route-dialog-poi').val()
  var poi_route_data = poi_route == 'None' ? null : dialog.data('routes')[poi_route];
  $('#flight-airframe').data('poi', poi_route_data).trigger('data-poi-updated');

  // Handle that which is supported by CF
  if (mission_route_data && mission_route_data.xml_format == "cf") {

    // Data -> Theatre
    var theater = xml.querySelector('Mission > Theater').textContent;
    $('#data-theatre').val(theater);

    if (mission_route_data.aircraft) {
      $('#flight-airframe').val(mission_route_data.aircraft).change();
    }

    // Update bulls, if we have a route selected, use side's bulls, else default blue
    var bulls = xml.querySelector(mission_route_data.side + "Bullseye");
    $('#waypoints-bullseye-name').val(bulls.getElementsByTagName("Name")[0].textContent);

    var bulls_lat = bulls.getElementsByTagName("Lat")[0].textContent;
    $('#waypoints-bullseye-lat').attr('data-raw', bulls_lat);

    var bulls_lon = bulls.getElementsByTagName("Lon")[0].textContent;
    $('#waypoints-bullseye-lon').attr('data-raw', bulls_lon);
  }

  // Update coordiantes
  coordinate_update_fields();

});

/******************************************************************************
* Export / Import
******************************************************************************/

function data_export() {
    var form = $("#data-form")
    var disabled = form.find(':input:disabled').removeAttr('disabled')
    var data = form.serializeObject()
    disabled.attr('disabled', 'disabled');
    return data
}

function data_load(data) {
    $('#data-mission').val(data.mission).change()
    $('#data-theatre').val(data.theatre).change()
}



/******************************************************************************
* Init
******************************************************************************/

zip.workerScriptsPath = 'js/zip-js/';

// opulate the Mission Data / Theatres
(function() {

  var input = $('#data-theatre');
  for (var x in theatres) {
    var def = theatres[x].default === true
    var option = new Option(theatres[x].display_name, x, def, def)
    input.append(option)
  }

  var input = $('#data-mission')
  for (var x in mission_data) {
    var def = mission_data[x].default === true
    var option = new Option(x, x, def, def)
    input.append(option)
  }

  // Issue changed on mission to ensure the theatre / etc. gets updated
  $('#data-mission').change()

}())

generate_mission_airfields();
