/* Magic Mirror Module Arrival times for bus stops in Singapore */

/* Magic Mirror
 * Module: MMM-SG-Transport-V2X
 *
 * By Moses Yong
 */

Module.register("MMM-SG-Transport-V2X", {

    // Default module config.
    defaults: {
        // API details, all required
        lta_api_key: null, // this must be set
        lta_api_url: "https://datamall2.mytransport.sg/ltaodataservice/v3/",
        lta_api_bus_arrival_path: "BusArrival",

        // Intervals
        refresh_interval: 30 * 1000, // refresh display every 30 seconds

        // Bus Stop IDs and Names to show
        bus_stops: [{
                BusStopCode: 43191,
                name: "Opp St Mary's",
                BusNumbers: [
                    "157",
                    "61",
                    "852"
                ]
            },
            {
                BusStopCode: 43619,
                name: "Opp Caltex"
            }
        ],
    },

    // Module startup procedure
    start: function() {

        // Create the main structure that holds the live bus stop data
        this.bus_stops = {}
        for (var i in this.config.bus_stops) {
            var config_bus_stop = this.config.bus_stops[i];
            this.bus_stops[config_bus_stop.BusStopCode] = {
                Name: config_bus_stop.name,
                Services: null,
                BusNumbers: config_bus_stop.BusNumbers
            };
        }

        // Share the config with the node_helper
        this.sendSocketNotification("CONFIG", this.config);
    },

    // Include styles:
    getStyles: function() {
        return [
            this.file("css/style.css")
        ]
    },

    getScripts: function () {
        return ["https://cdn.jsdelivr.net/npm/mustache@4.2.0/mustache.min.js"];
    },

    // Run on display refresh
    getDom: function() {
        // Display data
        const wrapper = document.createElement("div");
        wrapper.classList.add("small");

        if (!this.templateLoaded) {
            fetch("modules/MMM-SG-Transport-V2X/public/bus_template.html")
            .then(res => res.text())
            .then(html => {
                const temp = document.createElement("div");
                temp.innerHTML = html;
                this.template = temp.querySelector("#bus-template").innerHTML;
                this.templateLoaded = true;
                this.updateDom();
            });
            wrapper.innerHTML = "Loading template...";
            return wrapper;
        }

        const now = new Date();

        const data = {
            bus_stops: Object.entries(this.bus_stops || {}).map(([code, stop]) => {
            const services = (stop.Services || [])
                .filter(service => {
                const busNumbers = stop.BusNumbers;
                return !busNumbers || busNumbers.includes(service.ServiceNo);
                })
                .map(service => {
                const arrivals = [service.NextBus, service.NextBus2, service.NextBus3]
                    .filter(bus => bus && bus.EstimatedArrival && bus.EstimatedArrival !== "")
                    .map(bus => {
                    const etaTime = new Date(bus.EstimatedArrival);
                    let etaMinutes = Math.floor((etaTime - now) / 60000);
                    etaMinutes = etaMinutes < 1 ? "Arr" : `${etaMinutes}m`;

                    let stickmen = 0;
                    switch (bus.Load) {
                        case "SDA": stickmen = 2; break;
                        case "LSD": stickmen = 3; break;
                        case "SEA": stickmen = 1; break;
                    }

                    return {
                        eta: etaMinutes,
                        stickmen: Array.from({ length: stickmen })
                    };
                    });

                return {
                    serviceNo: service.ServiceNo,
                    arrivals
                };
                });

            return {
                name: stop.Name,
                services
            };
            })
        };

        wrapper.innerHTML = Mustache.render(this.template, data);
        return wrapper;
    },

    socketNotificationReceived: function(notification, payload) {

        if (notification === "UPDATE") {
            this.bus_stops[payload.BusStopCode].Services = payload.Services;
        }
        this.updateDom();
    }
});
