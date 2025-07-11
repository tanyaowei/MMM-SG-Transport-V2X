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
        lta_api_url: "https://datamall2.mytransport.sg/ltaodataservice/",
        lta_api_bus_arrival_path: "v3/BusArrival",
        lta_api_bus_stops_path: "BusStops",

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
                const soonestArrivals = [];
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
                                let isLessThanOne = etaMinutes < 1;
                                let etaText = etaMinutes < 1 ? "Arr" : `${etaMinutes}`;

                                let loadColor = "";
                                switch (bus.Load) {
                                    case "SDA": loadColor = "amber"; break;
                                    case "LSD": loadColor = "red"; break;
                                    case "SEA": loadColor = "green"; break;
                                }

                                let deckerImage = "";
                                switch (bus.Type) {
                                    case "SD": deckerImage = "sd-image"; break;
                                    case "DD": deckerImage = "dd-image"; break;
                                }

                                // Track soonest arrivals
                                soonestArrivals.push({
                                    eta: etaMinutes,
                                    etaText: etaText,
                                    isLessThanOne: isLessThanOne,
                                    serviceNo: service.ServiceNo,
                                    color: loadColor
                                });


                                return {
                                    etaText: etaText,
                                    deckerImage: deckerImage,
                                    isLessThanOne: isLessThanOne,
                                    color: loadColor
                                };
                            });

                        while (arrivals.length < 3) {
                            arrivals.push({ etaText: "-", isLessThanOne: true, color: "" });
                        }

                        return {
                            serviceNo: service.ServiceNo,
                            arrivals
                        };
                    });

                services.sort((a, b) => {
                const numA = parseInt(a.serviceNo, 10);
                const numB = parseInt(b.serviceNo, 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                return a.serviceNo.localeCompare(b.serviceNo); // fallback for alphanumerics like "2A", "NR6"
                });

                return {
                    busstopcode: `${code}`,
                    name: stop.Name,
                    top_arrivals: soonestArrivals
                        .sort((a, b) => a.eta - b.eta)
                        .slice(0, 5),
                    services
                };
            }),
        };

        wrapper.innerHTML = Mustache.render(this.template, data);
        return wrapper;
    },

    socketNotificationReceived: function(notification, payload) {

        if (notification === "SETUP") {
            this.bus_stops[payload.BusStopCode].Name = payload.Name;
        }
        else if (notification === "UPDATE") {
            this.bus_stops[payload.BusStopCode].Services = payload.Services;
        }
        this.updateDom();
    }
});
