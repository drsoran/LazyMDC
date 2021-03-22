
// Process new Combat Flite
$(document).on('flight-airframe-changed', function(e) {

  // Show CMDs if we're F-16C
  $('#profiles-f16').toggle($('#flight-airframe').val() == 'F-16C');

});

////////////////////////////////////////////////////////////
// F16 CMDS
////////////////////////////////////////////////////////////

function profiles_set_f16_cmds_formatter() {

  // data is an dict of program, chaff / flare, element
  var headers = get_row_data($("#profiles-f16-cmds-table > thead > tr:first")[0]);

  var precision = [0, 3, 0, 2]

  $("#profiles-f16-cmds-table > tbody > tr").each(function(row, tr) {
    for (var col = 1; col < tr.cells.length; col++) {
      number_formatter(tr.cells[col].firstChild, precision[row]);
    }
  });
}

function profiles_get_f16_cmds() {

  var row_formatters = [
    function(x) { return parseFloat(x).toFixed(0); }, // BQ integer
    function(x) { return parseFloat(x).toFixed(3); }, // BI 3 decimals
    function(x) { return parseFloat(x).toFixed(0); }, // SQ integer
    function(x) { return parseFloat(x).toFixed(2); }, // SI 2 decimals
  ]

  var ret = {}

  var headers = get_row_data($("#profiles-f16-cmds-table > thead > tr:first")[0]);

  $("#profiles-f16-cmds-table > tbody > tr").each(function(row, tr) {
    var data = get_row_data(tr);
    var param = data.shift();

    data.forEach(function(value, col) {
      var fmt = row_formatters[row];
      if (fmt) {
        value = fmt(value);
      }

      var mode = headers[Math.floor(col / 2)+1];
      if (!ret[mode]) { ret[mode] = {} }

      var cms = ['CHAFF', 'FLARE'][col % 2];
      if (!ret[mode][cms]) { ret[mode][cms] = {}; }

      ret[mode][cms][param] = value;
    });
  });

  // Now we mark which were modified, else return nothing
  var defaults = airframes['F-16C']['cmds'];
  var changes = false;

  for (const mode in ret) {
    var def = defaults[mode];
    var mode_changes = false;

    for (const cms in defaults[mode]) {
      if(JSONStringifyOrder(defaults[mode][cms]) != JSONStringifyOrder(ret[mode][cms])) {
        mode_changes = true;
        ret[mode][cms]['MODIFIED'] = 1;
      }
    }

    if (mode_changes) {
      ret[mode]['MODIFIED'] = 1;
      changes = true;
    }
  }

  return changes ? ret : null;

}

function profiles_set_f16_cmds(data) {

  if (!data) { return; }

  // data is an dict of program, chaff / flare, element
  var headers = get_row_data($("#profiles-f16-cmds-table > thead > tr:first")[0]);

  $("#profiles-f16-cmds-table > tbody > tr").each(function(row, tr) {
    var param = tr.cells[0].getAttribute('data-raw');

    // iterate each
    for (var col = 1; col < tr.cells.length; col++) {
      var mode = headers[Math.floor((col+1)/2)];
      var cms = ['CHAFF', 'FLARE'][(col+1) % 2];
      try {
        var val = parseFloat(data[mode][cms][param]);
        if (isNaN(val)) { return; }
        $(tr.cells[col].firstChild).val(val).change();
      } catch {}
    }
  });
}

// Set default CMDS from airframe props
profiles_set_f16_cmds(airframes['F-16C']['cmds']);
profiles_set_f16_cmds_formatter()

////////////////////////////////////////////////////////////
// F16 HARM TABLES
////////////////////////////////////////////////////////////

function profiles_f16_harm_lookup(request, response, heading) {

  function hasMatch(fs) {
    if (typeof fs !== 'string' || fs === "") {
      return false
    }
    return fs.toLowerCase().indexOf(request.term.toLowerCase()) !== -1;
  }

  if (request.term === "") {
    response([]);
    return
  }

  var matches = []
  var options = airframes['F-16C']['harm']['options'];

  options.forEach(function(elem) {

    // If we're the name field, use everything, else limit to single vlaue
    var search = heading != 'name' ? [elem[heading]] : Object.values(elem);

    if(search.find(elem => hasMatch(elem))) {
      var o = jQuery.extend({}, elem);
      o.label = `${elem.name} (${elem.id} - ${elem.rwr})`;
      o.value = heading == 'name' && elem.display ? elem.display : elem[heading]; 
      matches.push(o);
    }
  });

  response(matches);
}

function profiles_get_f16_harm() {

  var headers = get_row_data($("#profiles-f16-harm-table > thead > tr:last")[0]);
  var ret = [];

  $("#profiles-f16-harm-table > tbody > tr").each(function(row, tr) {
    get_row_data(tr).forEach(function(value, col) {
      var attr = headers[col].toLowerCase();
      var table = Math.floor(col / 3);
      if (!ret[table]) {
        ret[table] = {
          'values': []
        } 
      }
      if (!ret[table]['values'][row]) { ret[table]['values'][row] = {} }
      ret[table]['values'][row][attr] = value;
    });
  });

  // Now we mark which were modified, else return nothing
  var defaults = airframes['F-16C']['harm']['defaults'];
  var changes = false;

  for (const table in ret) {
    if(JSONStringifyOrder(defaults[table]['values']) != JSONStringifyOrder(ret[table]['values'])) {
      ret[table]['MODIFIED'] = 1;
      changes = true;
    }
  }

  return changes ? ret : null;
}

function profiles_set_f16_harm(data) {

  if (!data) { return; }


  // data is an dict of program, chaff / flare, element
  var headers = get_row_data($("#profiles-f16-harm-table > thead > tr:last")[0]);

  $("#profiles-f16-harm-table > tbody > tr").each(function(row, tr) {
    // iterate each
    for (var col = 0; col < tr.cells.length; col++) {
      var param = headers[col].toLowerCase();
      var table = Math.floor(col / 3)
      try {
        var val = data[table]['values'][row][param];
        $(tr.cells[col].firstChild).val(val);
      } catch {}
    }
  });
}

// HARM ID Autocompletes
$('#profiles-f16-harm-table > tbody > tr > td > input').each(function(idx, field) {

  // Offset in the id, rwr, name collection
  var offset = idx % 3;
  var heading = ['id', 'rwr', 'name'][offset]

  // Create Autocomplete
  $(field).autocomplete({
    source: function(request, response) {
      profiles_f16_harm_lookup(request, response, heading)
    },
    select: function(event, ui) {
      var id = $(event.target.parentElement).index() - offset;
      var tr = event.target.parentElement.parentElement;

      if (offset != 0) { tr.cells[id].firstChild.value = ui.item.id; }
      if (offset != 1) { tr.cells[id+1].firstChild.value = ui.item.rwr; }
      if (offset != 2) { tr.cells[id+2].firstChild.value = ui.item.name; }
    }
  });

  // Also set where to tab to; we go down the columns as it's more natural
  $(field).on('keydown', function(e) {
    if (e.which == 9) {
      var cell = $(event.target.parentElement);

      // Move down if we can
      var next_tr = cell.parent().next();
      if (next_tr.length) {
        next_tr[0].cells[cell.index()].firstChild.focus();
        return false;
      }

      // Else move to top of next row
      var cell = cell.parent().parent().find('tr:first()')[0].cells[cell.index()+1];
      if(cell) {
        cell.firstChild.focus();
        return false;
      }

      // If we get here, then we're the last cell, and it would be right to do
      // default behaviour and just continue to whatever is next
    }
  });

});


// Load default HARM tables
profiles_set_f16_harm(airframes['F-16C']['harm']['defaults']);

////////////////////////////////////////////////////////////
// GENERAL
////////////////////////////////////////////////////////////

function profiles_export() {
  var ret = get_form_data($("#profiles-form"));

  var type = $('#flight-airframe').val();
  var type_data = airframes[type];

  if (!type_data) {
    return {}
  }

  if (type == 'F-16C') {
    var cmds = profiles_get_f16_cmds();
    if (cmds) {
      ret['cmds'] = cmds;
    }

    var harm = profiles_get_f16_harm();
    if (harm) {
      ret['harm'] = harm;
    }
  }

  // Collect our notes
  ret['notes'] = {
    'html': tinymce ? tinymce.editors['profiles-mce'].getContent() : '',
    'title': 'LOADOUT INFORMATION',
  }

  return ret
}


function profiles_load(data, callback) {

  if (!data || data instanceof Array) { callback(); return }

  // Try and load F16 CMDS if present
  profiles_set_f16_cmds(data['cmds']);
  profiles_set_f16_harm(data['harm']);

  // Load notes if we have them
  if (data['notes'] && data['notes']['html'] && tinymce) {
    tinymce.editors['profiles-mce'].setContent(data['notes']['html']);
  }

  callback();
}
