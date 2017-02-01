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
    [],
    function () {

        describe('The TelemetryTableController', function () {

            var controller;

            function promise(value) {
                return {
                    then: function (callback) {
                        return promise(callback(value));
                    }
                };
            }

            function getCallback(target, event) {
                return target.calls.filter(function (call) {
                    return call.args[0] === event;
                })[0].args[1];
            }

            beforeEach(function () {
            });

            it('registers listeners', function () {
            });

            it('deregisters all listeners', function () {
            });

            it('When in real-time mode, enables auto-scroll', function () {
            });

            it('Scrolls on a column matching the selected time system', function () {
            });

            it('Removes telemetry rows that are now out of band from table', function () {
            });

            it('Populates table headers based on metadata for given objects', function () {
            });

        });
    });
