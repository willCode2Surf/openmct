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
        '../../src/controllers/TelemetryTableController',
        '../../../../../src/api/objects/object-utils',
        'lodash'
    ],
    function (TelemetryTableController, objectUtils, _) {

        describe('The TelemetryTableController', function () {

            var controller,
                mockScope,
                mockTimeout,
                mockConductor,
                mockAPI,
                mockDomainObject,
                mockTelemetryAPI,
                mockObjectAPI,
                mockCompositionAPI,
                unobserve,
                mockBounds;

            function getCallback(target, event) {
                return target.calls.filter(function (call) {
                    return call.args[0] === event;
                })[0].args[1];
            }

            beforeEach(function () {
                mockBounds = {
                    start: 0,
                    end: 10
                };
                mockConductor = jasmine.createSpyObj("conductor", [
                    "bounds",
                    "follow",
                    "on",
                    "off",
                    "timeSystem"
                ]);
                mockConductor.bounds.andReturn(mockBounds);
                mockConductor.follow.andReturn(false);

                mockDomainObject = jasmine.createSpyObj("domainObject", [
                    "getModel",
                    "getId",
                    "useCapability"
                ]);
                mockDomainObject.getModel.andReturn({});
                mockDomainObject.getId.andReturn("mockId");
                mockDomainObject.useCapability.andReturn(true);

                mockCompositionAPI = jasmine.createSpyObj("compositionAPI", [
                    "get"
                ]);

                mockObjectAPI = jasmine.createSpyObj("objectAPI", [
                    "observe"
                ]);
                unobserve = jasmine.createSpy("unobserve");
                mockObjectAPI.observe.andReturn(unobserve);

                mockScope = jasmine.createSpyObj("scope", [
                    "$on",
                    "$watch",
                    "$broadcast"
                ]);
                mockScope.domainObject = mockDomainObject;

                mockTelemetryAPI = jasmine.createSpyObj("telemetryAPI", [
                    "canProvideTelemetry",
                    "subscribe",
                    "getMetadata",
                    "commonValuesForHints",
                    "request",
                    "limitEvaluator",
                    "getValueFormatter"
                ]);
                mockTelemetryAPI.commonValuesForHints.andReturn([]);
                mockTelemetryAPI.request.andReturn(Promise.resolve([]));


                mockTelemetryAPI.canProvideTelemetry.andReturn(false);

                mockTimeout = jasmine.createSpy("timeout");
                mockTimeout.andReturn(1); // Return something
                mockTimeout.cancel = jasmine.createSpy("cancel");

                mockAPI = {
                    conductor: mockConductor,
                    objects: mockObjectAPI,
                    telemetry: mockTelemetryAPI,
                    composition: mockCompositionAPI
                };
                controller = new TelemetryTableController(mockScope, mockTimeout, mockAPI);
            });

            describe('listens for', function () {
                beforeEach(function () {
                    controller.registerChangeListeners();
                });
                it('object mutation', function () {
                    var calledObject = mockObjectAPI.observe.mostRecentCall.args[0];

                    expect(mockObjectAPI.observe).toHaveBeenCalled();
                    expect(calledObject.identifier.key).toEqual(mockDomainObject.getId());
                });
                it('conductor changes', function () {
                    expect(mockConductor.on).toHaveBeenCalledWith("timeSystem", jasmine.any(Function));
                    expect(mockConductor.on).toHaveBeenCalledWith("bounds", jasmine.any(Function));
                    expect(mockConductor.on).toHaveBeenCalledWith("follow", jasmine.any(Function));
                });
            });

            describe('deregisters all listeners on scope destruction', function () {
                var timeSystemListener,
                    boundsListener,
                    followListener;

                beforeEach(function () {
                    controller.registerChangeListeners();

                    timeSystemListener = getCallback(mockConductor.on, "timeSystem");
                    boundsListener = getCallback(mockConductor.on, "bounds");
                    followListener = getCallback(mockConductor.on, "follow");

                    var destroy = getCallback(mockScope.$on, "$destroy");
                    destroy();
                });

                it('object mutation', function () {
                    expect(unobserve).toHaveBeenCalled();
                });
                it('conductor changes', function () {
                    expect(mockConductor.off).toHaveBeenCalledWith("timeSystem", timeSystemListener);
                    expect(mockConductor.off).toHaveBeenCalledWith("bounds", boundsListener);
                    expect(mockConductor.off).toHaveBeenCalledWith("follow", followListener);
                });
            });

            describe ('Subscribes to new data', function () {
                var mockComposition,
                    mockTelemetryObject,
                    mockChildren,
                    unsubscribe,
                    done;

                beforeEach(function () {
                    mockComposition = jasmine.createSpyObj("composition", [
                        "load"
                    ]);

                    mockTelemetryObject = jasmine.createSpyObj("mockTelemetryObject", [
                        "something"
                    ]);
                    mockTelemetryObject.identifier = {
                        key: "mockTelemetryObject"
                    };

                    unsubscribe = jasmine.createSpy("unsubscribe");
                    mockTelemetryAPI.subscribe.andReturn(unsubscribe);

                    mockChildren = [mockTelemetryObject];
                    mockComposition.load.andReturn(Promise.resolve(mockChildren));
                    mockCompositionAPI.get.andReturn(mockComposition);

                    mockTelemetryAPI.canProvideTelemetry.andCallFake(function (obj) {
                        return obj.identifier.key === mockTelemetryObject.identifier.key;
                    });

                    done = false;
                    controller.getData().then(function () {
                        done = true;
                    });
                });

                it('fetches historical data', function () {
                    waitsFor(function () {
                        return done;
                    }, "getData to return", 100);

                    runs(function () {
                        expect(mockTelemetryAPI.request).toHaveBeenCalledWith(mockTelemetryObject, jasmine.any(Object));
                    });
                });

                it('fetches historical data for the time period specified by the conductor bounds', function () {
                    waitsFor(function () {
                        return done;
                    }, "getData to return", 100);

                    runs(function () {
                        expect(mockTelemetryAPI.request).toHaveBeenCalledWith(mockTelemetryObject, mockBounds);
                    });
                });

                it('subscribes to new data', function () {
                    waitsFor(function () {
                        return done;
                    }, "getData to return", 100);

                    runs(function () {
                        expect(mockTelemetryAPI.subscribe).toHaveBeenCalledWith(mockTelemetryObject, jasmine.any(Function), {});
                    });

                });
                it('and unsubscribes on view destruction', function () {
                    waitsFor(function () {
                        return done;
                    }, "getData to return", 100);

                    runs(function () {
                        var destroy = getCallback(mockScope.$on, "$destroy");
                        destroy();

                        expect(unsubscribe).toHaveBeenCalled();
                    });
                });
            });

            it('When in real-time mode, enables auto-scroll', function () {
                controller.registerChangeListeners();

                var followCallback = getCallback(mockConductor.on, "follow");
                //Confirm pre-condition
                expect(mockScope.autoScroll).toBeFalsy();

                //Mock setting the conductor to 'follow' mode
                followCallback(true);
                expect(mockScope.autoScroll).toBe(true);
            });

            describe('populates table columns', function () {
                var domainMetadata;
                var allMetadata;
                var mockTimeSystem;

                beforeEach(function () {
                    domainMetadata = [{
                        key: "column1",
                        name: "Column 1",
                        hints: {}
                    }];

                    allMetadata = [{
                        key: "column1",
                        name: "Column 1",
                        hints: {}
                    }, {
                        key: "column2",
                        name: "Column 2",
                        hints: {}
                    }, {
                        key: "column3",
                        name: "Column 3",
                        hints: {}
                    }];

                    mockTimeSystem = {
                        metadata: {
                            key: "column1"
                        }
                    };

                    mockTelemetryAPI.commonValuesForHints.andCallFake(function (metadata, hints) {
                        if (_.eq(hints, ["x"])) {
                            return domainMetadata;
                        } else if (_.eq(hints, [])) {
                            return allMetadata;
                        }
                    });

                    controller.loadColumns([mockDomainObject]);
                });

                it('based on metadata for given objects', function () {
                    expect(mockScope.headers).toBeDefined();
                    expect(mockScope.headers.length).toBeGreaterThan(0);
                    expect(mockScope.headers.indexOf(allMetadata[0].name)).not.toBe(-1);
                    expect(mockScope.headers.indexOf(allMetadata[1].name)).not.toBe(-1);
                    expect(mockScope.headers.indexOf(allMetadata[2].name)).not.toBe(-1);
                });

                it('and sorts by column matching time system', function () {
                    expect(mockScope.defaultSort).not.toEqual("Column 1");
                    controller.sortByTimeSystem(mockTimeSystem);
                    expect(mockScope.defaultSort).toEqual("Column 1");
                });

                it('batches processing of rows for performance when receiving historical telemetry', function () {
                    var mockHistoricalData = [
                        {
                            "column1": 1,
                            "column2": 2,
                            "column3": 3
                        },{
                            "column1": 4,
                            "column2": 5,
                            "column3": 6
                        }, {
                            "column1": 7,
                            "column2": 8,
                            "column3": 9
                        }
                    ];
                    controller.batchSize = 2;
                    mockTelemetryAPI.request.andReturn(Promise.resolve(mockHistoricalData));
                    controller.getHistoricalData([mockDomainObject]);

                    waitsFor(function () {
                        return !!controller.timeoutHandle;
                    }, "first batch to be processed", 100);

                    runs(function () {
                        //Verify that timeout is being used to yield process
                        expect(mockTimeout).toHaveBeenCalled();
                        mockTimeout.mostRecentCall.args[0]();
                        expect(mockTimeout.calls.length).toBe(2);
                        mockTimeout.mostRecentCall.args[0]()
                        expect(mockScope.rows.length).toBe(3);
                    })
                });
            });

            it('Removes telemetry rows from table when they fall out of bounds', function () {
                var discardedRows = [
                    {"column1": "value 1"},
                    {"column2": "value 2"},
                    {"column3": "value 3"}
                ];

                spyOn(controller.telemetry, "on").andCallThrough();

                controller.registerChangeListeners();
                expect(controller.telemetry.on).toHaveBeenCalledWith("discarded", jasmine.any(Function));
                var onDiscard = getCallback(controller.telemetry.on, "discarded");
                onDiscard(discardedRows);
                expect(mockScope.$broadcast).toHaveBeenCalledWith("remove:rows", discardedRows);
            });

        });
    });
