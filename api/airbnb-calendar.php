<?php

date_default_timezone_set('America/Sao_Paulo');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$today = date('Y-m-d');


// ==========================================================
// CONFIGURAÇÃO
// ==========================================================

$config = require __DIR__ . '/../config/calendar.php';

$airbnbCalendarUrl = $config['airbnb_ical_url'];


// Nunca coloque a URL diretamente no HTML ou JavaScript público.

if (!$airbnbCalendarUrl) {

    http_response_code(500);

    echo json_encode([
        'today' => $today,
        'blocked' => [],
        'error' => 'Calendário do Airbnb não configurado.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ==========================================================
// DOWNLOAD DO ICS
// ==========================================================

$context = stream_context_create([

    'http' => [

        'timeout' => 10,

        'header' =>
            "User-Agent: CasaNaMataCalendar/1.0\r\n"

    ]

]);


$ical = @file_get_contents(
    $airbnbCalendarUrl,
    false,
    $context
);


if ($ical === false) {

    http_response_code(502);

    echo json_encode([
        'today' => $today,
        'blocked' => [],
        'error' => 'Não foi possível consultar o Airbnb.'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}


// ==========================================================
// PARSE DOS EVENTOS
// ==========================================================

$events = [];


preg_match_all(
    '/BEGIN:VEVENT(.*?)END:VEVENT/s',
    $ical,
    $matches
);


foreach ($matches[1] as $event) {

    preg_match(
        '/DTSTART(?:;VALUE=DATE)?:([0-9]{8})/',
        $event,
        $start
    );

    preg_match(
        '/DTEND(?:;VALUE=DATE)?:([0-9]{8})/',
        $event,
        $end
    );


    if (
        !isset($start[1]) ||
        !isset($end[1])
    ) {
        continue;
    }


    $startDate = DateTime::createFromFormat(
        'Ymd',
        $start[1]
    );


    $endDate = DateTime::createFromFormat(
        'Ymd',
        $end[1]
    );


    if (!$startDate || !$endDate) {
        continue;
    }


    $events[] = [

        'start' => $startDate->format('Y-m-d'),

        'end' => $endDate->format('Y-m-d')

    ];

}


// ==========================================================
// SAÍDA
// ==========================================================

echo json_encode([
    'today' => $today,
    'blocked' => $events
], JSON_UNESCAPED_UNICODE);