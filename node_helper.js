// This node helper is in charge of requesting the data through the API.

var NodeHelper = require("node_helper");
var unirest = require("unirest");

module.exports = NodeHelper.create({

    start: function() {
        this.started = false;
    },

    updateData: function() {

        var self = this;

        // For each bus stop
        this.BusStopList.forEach(function(BusStopCode) {
            // Request for new bus timings    
            unirest.get(self.config.lta_api_url + self.config.lta_api_bus_arrival_path + "?BusStopCode=" + BusStopCode)
                .headers({ "AccountKey": self.config.lta_api_key })
                .end(function(response) {
                    self.sendSocketNotification("UPDATE", response.body);
                });
        });
    },

    // Recursive function to fetch all pages
    fetchBusStops: function(skip) {

        var self = this;

        unirest
            .get(self.config.lta_api_url + self.config.lta_api_bus_stops_path + "?$skip=" + skip)
            .headers({ "AccountKey": self.config.lta_api_key })
            .end((response) => {
                const records = response.body.value;

                if (records && records.length > 0) {
                    this.allBusStops.push(...records);

                    // Fetch next page
                    this.fetchBusStops(skip + 500);
                } else {
                    // No more records, process everything

                    // Build the mapping
                    const busStopMap = this.allBusStops.reduce((acc, curr) => {
                        acc[Number(curr.BusStopCode)] = curr.Description;
                        return acc;
                    }, {});

                    // Populate bus stops
                    for (var i in self.config.bus_stops) {
                        let config_bus_stop = self.config.bus_stops[i];

                        // If name is undefined/null/empty, use busStopMap
                        let name = config_bus_stop.name
                            ? config_bus_stop.name
                            : busStopMap[config_bus_stop.BusStopCode];

                        let obj = {
                            Name: name,
                            BusStopCode: config_bus_stop.BusStopCode
                        };
                    
                        // Share the config with the node_helper
                        self.sendSocketNotification("SETUP", obj);
                    }
                }
            });
    },

    socketNotificationReceived: function(notification, payload) {

        if (notification === "CONFIG" && this.started == false) {
            this.started = true;

            // Capture the config details
            this.config = payload;
            this.BusStopList = [];
            for (var i in this.config.bus_stops) {
                this.BusStopList.push(this.config.bus_stops[i].BusStopCode);
            }

            this.allBusStops = [];
            this.fetchBusStops(0);

            // Create an interval for requesting data
            const self = this;
            setInterval(function() {
                self.updateData();
            }, this.config.refresh_interval);

            // Start the first update
            this.updateData();
        }
    }
});