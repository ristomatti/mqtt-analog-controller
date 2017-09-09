const config = require('config');
const mqttjs = require('mqtt');
const linearScale = require('simple-linear-scale');
const approxEq = require('approximately-equal');
const { ADCPi } = require('abelectronics');

const { analogInputs, readInterval, tolerance, voltageMinMax } = config.get('adc');
const { url, clientOptions, topic, status } = config.get('mqtt');

const adc = new ADCPi(0x68, 0x69, 16);
const mqtt = mqttjs.connect(url, clientOptions);

const prevVoltage = {};

mqtt.on('connect', () => {
  mqtt.publish(status.topic, status.payload, status.options);

  setInterval(readInputs, readInterval);
  readInputs();
});

function readInputs() {
  resetConsole();

  analogInputs.forEach(input => {
    let voltage = round(adc.readVoltage(input));
    let minMax = voltageMinMax[input];
    let toPercentage = linearScale(minMax, [0, 100], true);
    let value = Math.round(toPercentage(voltage));

    console.log(`Input ${input}: ${value}% (${voltage}V)`);

    if (aboveTolerance(input, voltage)) {
      mqtt.publish(`${topic}/${input}`, JSON.stringify(value), {
        qos: 0,
        retain: false
      });
    }
    prevVoltage[input] = voltage;
  });
}

function aboveTolerance(input, voltage) {
  return !approxEq(voltage, prevVoltage[input], tolerance);
}

function round(voltage) {
  return Math.round(voltage * 1000) / 1000;
}

function resetConsole() {
  process.stdout.write('\033c');
}
