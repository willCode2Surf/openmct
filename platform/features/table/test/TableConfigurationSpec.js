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

define(
    [
        "../src/TableConfiguration"
    ],
    function (Table) {

        describe("A table", function () {
            var mockDomainObject,
                mockAPI,
                mockTelemetryAPI,
                mockTelemetryFormatter,
                table,
                mockModel;

            beforeEach(function () {
                mockDomainObject = jasmine.createSpyObj('domainObject',
                    ['getModel', 'useCapability', 'getCapability']
                );
                mockModel = {};
                mockDomainObject.getModel.andReturn(mockModel);
                mockTelemetryFormatter = jasmine.createSpyObj('telemetryFormatter',
                    [
                        'format'
                    ]);
                mockTelemetryFormatter.format.andCallFake(function (valueIn) {
                    return valueIn;
                });

                mockTelemetryAPI = jasmine.createSpyObj('telemetryAPI', [
                    'getValueFormatter'
                ]);
                mockAPI = {
                    telemetry: mockTelemetryAPI
                };
                mockTelemetryAPI.getValueFormatter.andReturn(mockTelemetryFormatter);

                table = new Table(mockDomainObject, mockAPI);
            });

            it("Add column with no index adds new column to the end", function () {
                var firstColumn = {title: 'First Column'},
                    secondColumn = {title: 'Second Column'},
                    thirdColumn = {title: 'Third Column'};

                table.addColumn(firstColumn);
                table.addColumn(secondColumn);
                table.addColumn(thirdColumn);

                expect(table.columns).toBeDefined();
                expect(table.columns.length).toBe(3);
                expect(table.columns[0]).toBe(firstColumn);
                expect(table.columns[1]).toBe(secondColumn);
                expect(table.columns[2]).toBe(thirdColumn);
            });

            it("Add column with index adds new column at the specified" +
                " position", function () {
                var firstColumn = {title: 'First Column'},
                    secondColumn = {title: 'Second Column'},
                    thirdColumn = {title: 'Third Column'};

                table.addColumn(firstColumn);
                table.addColumn(thirdColumn);
                table.addColumn(secondColumn, 1);

                expect(table.columns).toBeDefined();
                expect(table.columns.length).toBe(3);
                expect(table.columns[0]).toBe(firstColumn);
                expect(table.columns[1]).toBe(secondColumn);
                expect(table.columns[2]).toBe(thirdColumn);
            });

            describe("Building columns from telemetry metadata", function () {
                var metadata = [
                    {
                        name: 'Range 1',
                        key: 'range1',
                        hints: {}
                    },
                    {
                        name: 'Range 2',
                        key: 'range2',
                        hints: {}
                    },
                    {
                        name: 'Domain 1',
                        key: 'domain1',
                        format: 'utc',
                        hints: {
                            x: 1
                        }
                    },
                    {
                        name: 'Domain 2',
                        key: 'domain2',
                        format: 'utc',
                        hints: {
                            x: 2
                        }
                    }
                ];

                beforeEach(function () {
                    table.populateColumns(metadata);
                });

                it("populates columns", function () {
                    expect(table.columns.length).toBe(4);
                });

                it("Populates columns with domains arranged first", function () {
                    //TODO
                });

                it("Produces headers for each column based on title", function () {
                    var headers,
                        firstColumn = table.columns[0];

                    spyOn(firstColumn, 'getTitle');
                    headers = table.getHeaders();
                    expect(headers.length).toBe(4);
                    expect(firstColumn.getTitle).toHaveBeenCalled();
                });

                it("Provides a default configuration with all columns" +
                    " visible", function () {
                    var configuration = table.buildColumnConfiguration();

                    expect(configuration).toBeDefined();
                    expect(Object.keys(configuration).every(function (key) {
                        return configuration[key];
                    }));
                });

                it("Applies appropriate css class if limit violated.", function () {

                });

                it("Column configuration exposes persisted configuration", function () {
                    var tableConfig,
                        modelConfig = {
                        table: {
                            columns : {
                                'Range 1': false
                            }
                        }
                    };
                    mockModel.configuration = modelConfig;

                    tableConfig = table.buildColumnConfiguration();

                    expect(tableConfig).toBeDefined();
                    expect(tableConfig['Range 1']).toBe(false);
                });

                describe('retrieving row values', function () {
                    var datum,
                        rowValues;

                    beforeEach(function () {
                        datum = {
                            'range1': 'range 1 value',
                            'range2': 'range 2 value',
                            'domain1': 0,
                            'domain2': 1
                        };
                        rowValues = table.getRowValues(mockDomainObject, datum);
                    });

                    it("Returns a value for every column", function () {
                        expect(rowValues['Range 1'].text).toBeDefined();
                        expect(rowValues['Range 1'].text).toEqual('range 1' +
                            ' value');
                    });

                    it("Uses the telemetry formatter to appropriately format" +
                        " telemetry values", function () {
                        expect(mockTelemetryFormatter.format).toHaveBeenCalled();
                    });
                });
            });
        });
    }
);
