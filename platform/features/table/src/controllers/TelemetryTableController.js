/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2016, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

/**
 * This bundle adds a table view for displaying telemetry data.
 * @namespace platform/features/table
 */
define(
    [
        '../TableConfiguration',
        '../../../../../src/api/objects/object-utils'

    ],
    function (TableConfiguration, objectUtils) {

        /**
         * The TableController is responsible for getting data onto the page
         * in the table widget. This includes handling composition,
         * configuration, and telemetry subscriptions.
         * @memberof platform/features/table
         * @param $scope
         * @constructor
         */
        function TelemetryTableController(
            $scope,
            $timeout,
            openmct
        ) {
            this.$scope = $scope;
            this.$timeout = $timeout;
            this.openmct = openmct;
            this.batchSize = 1000;

            /*
             * Initialization block
             */
            this.columns = {}; //Range and Domain columns
            this.deregisterListeners = [];
            this.subscriptions = [];
            this.timeColumns = [];
            $scope.rows = [];
            this.table = new TableConfiguration($scope.domainObject,
                openmct);

            /*
             * Create a new format object from legacy object, and replace it
             * when it changes
             */
            this.newObject = objectUtils.toNewFormat($scope.domainObject.getModel(),
                $scope.domainObject.getId());

            _.bindAll(this, [
                'destroy',
                'sortByTimeSystem',
                'loadColumns',
                'getHistoricalData',
                'subscribeToNewData'
            ]);

            this.getData();
            this.registerChangeListeners();

            this.$scope.$on("$destroy", this.destroy);
        }

        /**
         * Based on the selected time system, find a matching domain column
         * to sort by. By default will just match on key.
         * @param timeSystem
         */
        TelemetryTableController.prototype.sortByTimeSystem = function (timeSystem) {
            var scope = this.$scope;
            scope.defaultSort = undefined;
            if (timeSystem) {
                this.table.columns.forEach(function (column) {
                    if (column.metadata.key === timeSystem.metadata.key) {
                        scope.defaultSort = column.getTitle();
                    }
                });
            }
        };

        /**
         * Attach listeners to domain object to respond to changes due to
         * composition, etc.
         * @private
         */
        TelemetryTableController.prototype.registerChangeListeners = function () {
            this.deregisterListeners.forEach(function (deregister){
                deregister();
            });

            this.deregisterListeners.push(
                this.openmct.objects.observe(this.newObject, "*",
                    function (domainObject){
                        this.newObject = domainObject;
                        this.getData();
                    }.bind(this)
                )
            );

            this.openmct.conductor.on('timeSystem', this.sortByTimeSystem);
            this.openmct.conductor.off('timeSystem', this.sortByTimeSystem);
        };

        /**
         * Release the current subscription (called when scope is destroyed)
         */
        TelemetryTableController.prototype.destroy = function () {
            this.subscriptions.forEach(function (subscription) {
                subscription();
            });
            this.deregisterListeners.forEach(function (deregister){
                deregister();
            });
        };

        /**
         * @private
         * @param objects
         * @returns {*}
         */
        TelemetryTableController.prototype.loadColumns = function (objects) {
            var telemetryApi = this.openmct.telemetry;

            if (objects.length > 0) {
                var metadatas = objects.map(telemetryApi.getMetadata.bind(telemetryApi));
                var allColumns = telemetryApi.commonValuesForHints(metadatas, []);

                this.table.populateColumns(allColumns);

                this.timeColumns = telemetryApi.commonValuesForHints(metadatas, ['x']).map(function (metadatum) {
                    return metadatum.name;
                });

                this.filterColumns();
            }
            return objects;
        };

        /**
         * @private
         * @param objects The domain objects to request telemetry for
         * @returns {*|{configFile}|app|boolean|Route|Object}
         */
        TelemetryTableController.prototype.getHistoricalData = function (objects) {
            var openmct = this.openmct;
            var bounds = openmct.conductor.bounds();
            var scope = this.$scope;
            var processedObjects = 0;

            var promise = new Promise(function (resolve, reject){
                function finishProcessing(tableRows){
                    scope.rows = tableRows;
                    scope.loading = false;
                    resolve(tableRows);
                }

                function processData(historicalData, index, rowData, limitEvaluator){
                    console.log("Processing batch");
                    if (index >= historicalData.length) {
                        processedObjects++;

                        if (processedObjects === objects.length) {
                            finishProcessing(rowData);
                        }
                    } else {
                        rowData = rowData.concat(historicalData.slice(index, index + this.batchSize)
                            .map(this.table.getRowValues.bind(this.table, limitEvaluator)));
                        this.timeoutHandle = this.$timeout(processData.bind(
                            this,
                            historicalData,
                            index + this.batchSize,
                            rowData,
                            limitEvaluator
                        ));
                    }
                }

                function makeTableRows(object, historicalData) {
                    var limitEvaluator = openmct.telemetry.limitEvaluator(object);
                    processData.call(this, historicalData, 0, [], limitEvaluator);
                }

                function requestData (object) {
                    return openmct.telemetry.request(object, {
                        start: bounds.start,
                        end: bounds.end
                    }).then(makeTableRows.bind(this, object))
                        .catch(reject);
                }
                this.$timeout.cancel(this.timeoutHandle);
                objects.forEach(requestData.bind(this));
            }.bind(this));

            return promise;
        };

        /**
         * @private
         * @param objects
         * @returns {*}
         */
        TelemetryTableController.prototype.subscribeToNewData = function (objects) {
            var telemetryApi = this.openmct.telemetry;
            //Set table max length to avoid unbounded growth.
            var maxRows = 100000;

            function newData(domainObject, datum) {
                this.$scope.rows.push(this.table.getRowValues(
                    telemetryApi.limitEvaluator(domainObject), datum));

                //Inform table that a new row has been added
                if (this.$scope.rows.length > maxRows) {
                    this.$scope.$broadcast('remove:row', 0);
                    this.$scope.rows.shift();
                }

                this.$scope.$broadcast('add:row',
                    this.$scope.rows.length - 1);

            }

            objects.forEach(function (object){
                this.subscriptions.push(
                    telemetryApi.subscribe(object, newData.bind(this, object), {}));
            }.bind(this));

            return objects;
        };

        TelemetryTableController.prototype.getData = function () {
            var telemetryApi = this.openmct.telemetry;
            var compositionApi = this.openmct.composition;
            var scope = this.$scope;
            var newObject = this.newObject;

            this.$scope.loading = true;

            function error(e) {
                scope.loading = false;
                console.error(e);
            }

            function filterForTelemetry(objects){
                return objects.filter(telemetryApi.canProvideTelemetry.bind(telemetryApi));
            }

            function getDomainObjects() {
                return new Promise(function (resolve, reject){
                    var objects = [newObject];
                    var composition = compositionApi.get(newObject);

                    if (composition) {
                        composition
                            .load()
                            .then(function (children) {
                                return objects.concat(children);
                            })
                            .then(resolve)
                            .catch(reject);
                    } else {
                        return resolve(objects);
                    }
                });
            }

            scope.headers = [];
            scope.rows = [];

            getDomainObjects()
            .then(filterForTelemetry)
            .then(this.loadColumns)
            //.then(this.subscribeToNewData)
            .then(this.getHistoricalData)
            .catch(error)
        };

        /**
         * When column configuration changes, update the visible headers
         * accordingly.
         * @private
         */
        TelemetryTableController.prototype.filterColumns = function () {
            var columnConfig = this.table.buildColumnConfiguration();

            //Populate headers with visible columns (determined by configuration)
            this.$scope.headers = Object.keys(columnConfig).filter(function (column) {
                return columnConfig[column];
            });
        };

        return TelemetryTableController;
    }
);
