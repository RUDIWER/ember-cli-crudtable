import modal from './modal';
import ComplexModel from '../privateclasses/complexmodel';

export function metadata (component, records) {
	component.get('paginator').update(component, records.get("meta"), records.get('length'));
	component.get('paginator').generateLinks();
};
const exportData = function (component, format, joinchar) {
	let data = [];
	let row = [];
	component.labels.forEach(function (field) {
		row.push(field.Display);
	});
	data.push(row);
	component.get('ComplexModel').forEach(function (model) {
		row = [];
		model.forEach(function (field) {
			row.push(field.Value);
		});
		data.push(row);
	});
	let content = "data:text/" + format + ";charset=utf-8,";
	data.forEach(function (infoArray, index) {
		let dataString = infoArray.join(joinchar);
		content += index < data.length ? dataString + "\n" : dataString;
	});
	content = encodeURI(content);
	let link = document.createElement("a");
	link.setAttribute("href", content);
	link.setAttribute("download", component.get('paginator').get('name') + "." + format);
	component.set('dlf', link);
	if (link.click) {
		link.click();
	}
}
export function makeRequest (component, query, done, fail) {
	let deferred = Ember.RSVP.defer('crud-table#createRecord');
	component.set('isLoading', true);
	component.sendAction('searchRecord', query, deferred);
	_getRequest(component,deferred);
	return deferred;
}
export function _getRequest (component, deferred, done, fail) {
	deferred.promise.then(function (records) {
			component.set("_table", records.type.modelName);
			metadata(component, records);
			component.set('value', records);
			ComplexModel.update(component);
			component.set('isLoading', false);
			if (done) {
				done();
			}
		},
		function (data) {
			component.set('isLoading', false);
			if (fail) {
				fail();
			}
		});
}
export let actions = {
	select: function (record) {
		this.set('currentRecord', record);
	},
	generic_callback: function () {
		this.set('Callback', arguments[0]);
		delete arguments[0];
		let args = ['Callback', this.get('currentRecord')].concat([].slice.call(arguments));
		this.sendAction.apply(this, args);
		this.set('Callback', null);
	},
	internal_choose: function (incomming) {
		this.set('Callback', incomming);
		this.sendAction('Callback', this.get('currentRecord'));
		this.set('Callback', null);
	},
	toJSONObject: function () {
		let data = [];
		this.get('ComplexModel').forEach(function (model) {
			let row = {};
			model.forEach(function (field) {
				row[field.Field] = field.Value;
			});
			data.push(row);
		});
		let csvContent = "data:text/json;charset=utf-8," + JSON.stringify(data);
		let encodedUri = encodeURI(csvContent);
		let link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", this.get("_table") + ".json");
		this.set('dlf', link);
		if (link.click) {
			link.click();
		}
	},
	toTSV: function () {
		exportData(this,"tsv", "\t");
	},
	toCSV: function () {
		exportData(this,"csv", ",");
	},
	toSQL() {
		let component = this;
		let data = [];
		this.get('ComplexModel').forEach(function (model) {
			let columns = [];
			let values = [];
			model.forEach(function (field) {
				columns.push(field.Field);
				values.push(field.Value);
			});
			data.push("INSERT INTO " + component.get('_table') + "(" + columns.join(",") + ") VALUES('" + values.join("','") + "')");
		});
		let csvContent = "data:text/sql;charset=utf-8," + data.join("\n");
		let encodedUri = encodeURI(csvContent);
		let link = document.createElement("a");
		link.setAttribute("href", encodedUri);
		link.setAttribute("download", this.get('_table') + ".sql");
		this.set('dlf', link);
		if (link.click) {
			link.click();
		}
	},
	goto: function (page) {
		if (page !== 0 && this.get('paginator').get('current') !== page) {
			this.get('paginator').getBody(page, lastquery);
			makeRequest(this,lastquery);
		}
	},
	internal_cancel: function () {
		this.set('notEdition', true);
		this.set('isEdition', false);
	},
	internal_search: function () {
		let component = this;
		let field = $("#SearchField").val();
		Object.keys(component.fields).forEach(function (fieldname) {
			if (component.fields[fieldname].Label === field) {
				field = fieldname;
			}
		});
		let query = {};
		component.get('paginator').getBody(0, query);
		query[field] = component.get('SearchTerm');
		if (query[field] === "") {
			delete query[field];
		}
		lastquery = query;
		makeRequest(component,lastquery);
	},
	confirm: function () {
		let component = this;
		let deferred;
		this.set('isLoading', true);
		if (component.get('newRecord')) {
			deferred = Ember.RSVP.defer('crud-table#createRecord');
			component.sendAction('createRecord', component.get('currentRecord').RoutedRecord, deferred);
		} else if (component.get('showMap')) {
			let record = component.get('currentRecord');
			let map;
			let RoutedPropMap;
			record.forEach(function (prop) {
				RoutedPropMap = prop;
				switch (prop.Type) {
				case 'googlemap':
					map = record.get('map').getCenter();
					prop.set('Value', map.toUrlValue());
					break;
				case 'many-multi':
					break;
				}
			});
			deferred = Ember.RSVP.defer('crud-table#updateRecord');
			let geocoder = new google.maps.Geocoder();
			geocoder.geocodefunction({
				'latLng': map
			}, function (results, status) {
				if (status === google.maps.GeocoderStatus.OK) {
					if (results[0]) {
						let add = results[0].formatted_address;
						let use = prompt('Suggested address is:\n' + add + '\n If you want to use it leave the field empty.');
						if (use === null || use === "") {
							record.RoutedRecord.set(RoutedPropMap.DisplayField, add);
						} else {
							record.RoutedRecord.set(RoutedPropMap.DisplayField, use);
						}
						record.RoutedRecord.set(RoutedPropMap.Zoom.field, record.get('map').getZoom());
					} else {
						console.warn("address not found");
					}
				} else {
					console.warn("Geocoder failed due to: " + status);
				}
				component.sendAction('updateRecord', record.RoutedRecord, deferred);
			});
		} else {
			if (component.get('isDeleting')) {
				deferred = Ember.RSVP.defer('crud-table#deleteRecord');
				component.sendAction('deleteRecord', component.get('currentRecord').RoutedRecord, deferred);
			} else {
				deferred = Ember.RSVP.defer('crud-table#updateRecord');
				component.sendAction('updateRecord', component.get('currentRecord').RoutedRecord, deferred);
			}
		}
		let updateview = Ember.RSVP.defer('crud-table#pagination');
		deferred.promise.then(function () {
			if (component.get('paginator') !== undefined) {
				component.get('paginator').getBody(component.get('paginator').get('page'), lastquery);
			} else {
				delete lastquery.page;
			}
			component.sendAction('searchRecord', lastquery, updateview);
		}, function () {
			this.set('isEdition', false);
			this.set('notEdition', true);
			this.set('isLoading', false);
		});
		_getRequest(component, updateview, function () {
			hidemodal();
			this.set('isEdition', false);
			this.set('notEdition', true);
		}, function () {
			hidemodal();
			this.set('isEdition', false);
			this.set('notEdition', true);
		})
	},
	internal_order: function (label) {
		this.get('labels').forEach(function (lbl) {
			if (label !== lbl) {
				Ember.set(lbl, 'Order_ASC', false);
				Ember.set(lbl, 'Order_DESC', false);
				Ember.set(lbl, 'Order', 0);
			}
		});
		//label.set('Order_ASC',true);
		if (!Ember.get(label, 'Order_DESC')) {
			Ember.set(label, 'Order_ASC', false);
			Ember.set(label, 'Order_DESC', true);
			Ember.set(label, 'Order', 2);
		} else {
			Ember.set(label, 'Order_ASC', true);
			Ember.set(label, 'Order_DESC', false);
			Ember.set(label, 'Order', 1);
		}
		this.get('paginator').sortData(label, lastquery);
		makeRequest(this,lastquery);

	},
	internal_map: function (record, kind) {

		if (google === undefined) {
			return;
		}
		this.set('showMap', true);
		modal.show();

		function mapit(id, latlng) {
			if (document.getElementById(id) === null) {
				return false;
			}
			let mapOptions = {
				zoom: latlng.zoom,
				center: new google.maps.LatLng(latlng.lat, latlng.lng),
				mapTypeId: google.maps.MapTypeId.ROADMAP
			};
			let map = new google.maps.Map(document.getElementById(id), mapOptions);
			record.set('map', map);
			return true;
		}

		let cord = "";
		record.forEach(function (prop) {
			if (prop.Type === kind) {
				cord = prop.Value.split(',');
				cord = {
					lat: cord[0],
					lng: cord[1],
					zoom: prop.Zoom.value
				};
			}
		});
		let component = this;
		let waitforgoogle = function (fn) {
			if (google === undefined) {
				setTimeout(function () {
					fn(fn);
				}, 10);
				return false;
			}
			if (mapit('google_map_canvas', cord)) {
				setTimeout(function () {
					component.set('currentRecord', record);
				}, 1);
			} else {
				setTimeout(function () {
					fn(fn);
				}, 10);
			}
		};
		waitforgoogle(waitforgoogle);
	},
	internal_create: function () {
		let component = this;
		let records = component.get('value').get('isLoaded') === true ? component.get('value') : component.get('value').get('content');
		this.set('newRecord', true);
		let deferred = Ember.RSVP.defer('crud-table#newRecord');
		component.sendAction('getRecord', deferred);
		deferred.promise.then(function (record) {
				Object.keys(proccesDef).forEach(function (field) {
					record.set(field, proccesDef[field](component.get('targetObject').get('model')));
				});
				if (record._internalModel !== undefined) {
					records.addObject(record._internalModel);
				} else {
					records.push(record);
				}
				ComplexModel.update(component);
				this.set('currentRecord', component.get('ComplexModel').get('lastObject'));
				modal.show();
			},
			function () {
				console.debug('Something went wrong');
			});
	},
	internal_edit: function (record) {
		this.set('notEdition', false);
		this.set('isEdition', true);
		this.set('isDeleting', false);
		this.set('currentRecord', record);
		modal.show();
	},
	internal_delete: function (record) {

		this.set('newRecord', false);
		this.set('isDeleting', true);
		this.set('currentRecord', record);
		modal.show();
	},
	intetnal_setlimit: function (limit) {

		limit = limit === "all" ? this.get('paginator').get('total') : limit;
		this.get('paginator').set('limit', limit);
		this.get('paginator').getBody(1, lastquery);
		makeRequest(this,lastquery);
	},
	internal_reload() {
		makeRequest(this,lastquery);
	}
};
