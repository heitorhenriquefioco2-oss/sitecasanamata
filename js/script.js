document.addEventListener("DOMContentLoaded", async () => {

    /* =====================================================
       NAVBAR
    ====================================================== */

    const navbar = document.getElementById("mainNavbar");

    function updateNavbar() {

        if (!navbar) {
            return;
        }

        if (window.scrollY > 80) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }

    }

    updateNavbar();

    window.addEventListener("scroll", updateNavbar);



    /* =====================================================
       CALENDÁRIO
    ====================================================== */

    const calendarElement =
        document.getElementById("bookingCalendar");

    /*
     * Se a página não tiver a agenda,
     * o restante do JS continua funcionando normalmente.
     */
    if (!calendarElement) {
        return;
    }


    if (typeof FullCalendar === "undefined") {

        console.error(
            "FullCalendar não foi carregado."
        );

        return;
    }


    /* =====================================================
       VARIÁVEIS
    ====================================================== */

    let blockedDates = [];
    let todayDate = null;
    let calendarDataReady = false;

    let checkin = null;
    let checkout = null;



    /* =====================================================
       ELEMENTOS
    ====================================================== */

    const checkinElement =
        document.getElementById("checkinDate");

    const checkoutElement =
        document.getElementById("checkoutDate");

    const messageElement =
        document.getElementById("availabilityMessage");

    const whatsappButton =
        document.getElementById("whatsappBookingButton");

    const airbnbButton =
        document.getElementById("airbnbBookingButton");



    /* =====================================================
       CARREGAR CALENDÁRIO DO AIRBNB
    ====================================================== */

    try {

        showMessage(
            "Carregando disponibilidade...",
            "loading"
        );

        const response = await fetch(
            "api/airbnb-calendar.php",
            {
                cache: "no-store"
            }
        );


        const data = await response.json();


        /*
         * A data de hoje vem do servidor para não depender
         * do relógio configurado no computador/celular do visitante.
         */
        if (data && typeof data.today === "string") {
            todayDate = data.today;
        }


        if (!response.ok) {

            throw new Error(
                data?.error ||
                `Erro HTTP ${response.status}`
            );

        }


        if (
            !data ||
            !todayDate ||
            !Array.isArray(data.blocked)
        ) {

            throw new Error(
                data?.error ||
                "Resposta inválida do calendário."
            );

        }


        blockedDates = data.blocked;
        calendarDataReady = true;

        clearMessage();

    } catch (error) {

        console.error(
            "Erro ao carregar calendário:",
            error
        );

        if (!todayDate) {
            todayDate = formatDate(new Date());
        }

        showMessage(
            "Não foi possível carregar a disponibilidade no momento. Tente novamente em alguns instantes.",
            "error"
        );

    }



    /* =====================================================
       CRIAR FULLCALENDAR
    ====================================================== */

    const calendar = new FullCalendar.Calendar(
        calendarElement,
        {

            locale: "pt-br",

            initialView: "dayGridMonth",

            initialDate: todayDate,

            validRange: {
                start: todayDate
            },

            firstDay: 0,

            fixedWeekCount: false,

            showNonCurrentDates: false,

            height: "auto",

            selectable: false,

            dayMaxEvents: false,



            /* =============================================
               CABEÇALHO
            ============================================= */

            headerToolbar: {

                left: "prev",

                center: "title",

                right: "next"

            },



            /* =============================================
               EVENTOS DO AIRBNB
            ============================================= */

            events: blockedDates.map(
                reservation => ({

                    start: reservation.start,

                    end: reservation.end,

                    display: "background",

                    classNames: [
                        "booked-date"
                    ]

                })
            ),



            /* =============================================
               QUANDO CADA DIA É CRIADO
            ============================================= */

            dayCellDidMount(info) {

                const date =
                    formatDate(info.date);


                /*
                 * "Hoje" também usa a data informada pelo servidor.
                 */
                if (date === todayDate) {

                    info.el.classList.add(
                        "date-today"
                    );

                    info.el.title = "Hoje";

                }


                /*
                 * Dias anteriores a hoje.
                 */
                if (isPastDate(date)) {

                    info.el.classList.add(
                        "date-past"
                    );

                    info.el.title = "Data passada";

                    return;

                }


                /*
                 * Dias ocupados.
                 */
                if (isBlockedDate(date)) {

                    info.el.classList.add(
                        "date-unavailable"
                    );

                    info.el.title = "Indisponível";

                    return;

                }


                if (date !== todayDate) {
                    info.el.title = "Disponível";
                }

            },



            /* =============================================
               CLIQUE EM UMA DATA
            ============================================= */

            dateClick(info) {

                const date = info.dateStr;


                if (!calendarDataReady) {

                    showMessage(
                        "A disponibilidade ainda não pôde ser confirmada. Tente novamente em alguns instantes.",
                        "error"
                    );

                    return;

                }


                /*
                 * Não permite datas passadas.
                 */
                if (isPastDate(date)) {

                    showMessage(
                        "Essa data já passou.",
                        "error"
                    );

                    return;

                }


                handleDateSelection(date);

            },



            /* =============================================
               TROCA DE MÊS
            ============================================= */

            datesSet() {

                /*
                 * Reaplica a seleção depois
                 * de trocar de mês.
                 */
                setTimeout(
                    updateSelectedDays,
                    0
                );

            }

        }
    );


    calendar.render();



    /* =====================================================
       SELEÇÃO DE DATAS
    ====================================================== */

    function handleDateSelection(date) {

        /*
         * ---------------------------------------------
         * PRIMEIRO CLIQUE
         * CHECK-IN
         * ---------------------------------------------
         */

        if (!checkin) {

            if (isBlockedDate(date)) {

                showMessage(
                    "Essa data não está disponível para check-in.",
                    "error"
                );

                return;

            }


            checkin = date;
            checkout = null;

            updateSelection();

            return;

        }



        /*
         * ---------------------------------------------
         * SEGUNDO CLIQUE
         * CHECK-OUT
         * ---------------------------------------------
         */

        if (!checkout) {

            /*
             * Se clicar antes ou no mesmo dia
             * do check-in, começa outra seleção.
             */

            if (date <= checkin) {

                if (isBlockedDate(date)) {

                    showMessage(
                        "Essa data não está disponível.",
                        "error"
                    );

                    return;

                }


                checkin = date;
                checkout = null;

                updateSelection();

                return;

            }


            /*
             * Procura uma reserva entre
             * check-in e check-out.
             *
             * O dia do checkout não é incluído,
             * porque o hóspede sai nesse dia.
             */

            if (
                hasBlockedDateBetween(
                    checkin,
                    date
                )
            ) {

                showMessage(
                    "Há uma reserva do Airbnb dentro desse período. Escolha outras datas.",
                    "error"
                );

                return;

            }


            checkout = date;

            updateSelection();

            return;

        }



        /*
         * ---------------------------------------------
         * TERCEIRO CLIQUE
         *
         * Começa uma nova reserva.
         * ---------------------------------------------
         */

        if (isBlockedDate(date)) {

            showMessage(
                "Essa data não está disponível para check-in.",
                "error"
            );

            return;

        }


        checkin = date;
        checkout = null;

        updateSelection();

    }



    /* =====================================================
       ATUALIZAR SELEÇÃO
    ====================================================== */

    function updateSelection() {

        if (checkinElement) {

            checkinElement.textContent =
                checkin
                    ? humanDate(checkin)
                    : "—";

        }


        if (checkoutElement) {

            checkoutElement.textContent =
                checkout
                    ? humanDate(checkout)
                    : "—";

        }


        /*
         * Período completo.
         */

        if (
            checkin &&
            checkout
        ) {

            const nights =
                calculateNights(
                    checkin,
                    checkout
                );


            showMessage(
                `Período disponível · ${nights} ${
                    nights === 1
                        ? "noite"
                        : "noites"
                }`,
                "success"
            );


            updateWhatsappLink();

            updateAirbnbLink();

        } else {

            clearMessage();

        }


        updateSelectedDays();

    }



    /* =====================================================
       DESTACAR DATAS ESCOLHIDAS
    ====================================================== */

    function updateSelectedDays() {

        const days =
            document.querySelectorAll(
                ".fc-daygrid-day[data-date]"
            );


        days.forEach(day => {

            day.classList.remove(
                "selected-day",
                "selected-start",
                "selected-end"
            );


            const date =
                day.dataset.date;


            if (!checkin) {
                return;
            }


            /*
             * Apenas check-in.
             */

            if (
                date === checkin
            ) {

                day.classList.add(
                    "selected-day",
                    "selected-start"
                );

            }


            /*
             * Intervalo.
             */

            if (
                checkin &&
                checkout &&
                date >= checkin &&
                date <= checkout
            ) {

                day.classList.add(
                    "selected-day"
                );

            }


            /*
             * Check-out.
             */

            if (
                checkout &&
                date === checkout
            ) {

                day.classList.add(
                    "selected-end"
                );

            }

        });

    }



    /* =====================================================
       WHATSAPP
    ====================================================== */

    function updateWhatsappLink() {

        if (
            !whatsappButton ||
            !checkin ||
            !checkout
        ) {
            return;
        }


        const nights =
            calculateNights(
                checkin,
                checkout
            );


        const message =
`Olá! Gostaria de consultar uma reserva na Casa na Mata.

Check-in: ${humanDate(checkin)}
Check-out: ${humanDate(checkout)}
Estadia: ${nights} ${nights === 1 ? "noite" : "noites"}`;


        whatsappButton.href =
            "https://wa.me/553599364244?text=" +
            encodeURIComponent(message);

    }



    /* =====================================================
       AIRBNB
    ====================================================== */

    function updateAirbnbLink() {

        if (
            !airbnbButton ||
            !checkin ||
            !checkout
        ) {
            return;
        }


        const airbnbUrl =
            new URL(
                "https://www.airbnb.com.br/rooms/1053474893113613835"
            );


        airbnbUrl.searchParams.set(
            "check_in",
            checkin
        );


        airbnbUrl.searchParams.set(
            "check_out",
            checkout
        );


        airbnbButton.href =
            airbnbUrl.toString();

    }



    /* =====================================================
       VERIFICAR DATA OCUPADA
    ====================================================== */

    function isBlockedDate(date) {

        return blockedDates.some(
            reservation => {

                /*
                 * O DTEND do iCal é exclusivo.
                 *
                 * Exemplo:
                 *
                 * start = dia 10
                 * end   = dia 13
                 *
                 * noites ocupadas:
                 * 10, 11 e 12.
                 */

                return (
                    date >= reservation.start &&
                    date < reservation.end
                );

            }
        );

    }



    /* =====================================================
       VERIFICAR RESERVA DENTRO DO INTERVALO
    ====================================================== */

    function hasBlockedDateBetween(
        start,
        end
    ) {

        let current =
            parseDate(start);


        const finalDate =
            parseDate(end);


        /*
         * Não verificamos o próprio checkout.
         */

        while (
            current < finalDate
        ) {

            const formatted =
                formatDate(current);


            if (
                isBlockedDate(formatted)
            ) {

                return true;

            }


            current.setDate(
                current.getDate() + 1
            );

        }


        return false;

    }



    /* =====================================================
       DATA PASSADA
    ====================================================== */

    function isPastDate(date) {

        if (!todayDate) {
            return false;
        }

        /*
         * YYYY-MM-DD pode ser comparado diretamente.
         * Isso evita diferenças de fuso horário e relógio do navegador.
         */
        return date < todayDate;

    }



    /* =====================================================
       NÚMERO DE NOITES
    ====================================================== */

    function calculateNights(
        start,
        end
    ) {

        const startDate =
            parseDate(start);


        const endDate =
            parseDate(end);


        const milliseconds =
            endDate - startDate;


        return Math.round(
            milliseconds /
            (
                1000 *
                60 *
                60 *
                24
            )
        );

    }



    /* =====================================================
       CONVERTER YYYY-MM-DD PARA DATE
    ====================================================== */

    function parseDate(date) {

        const [
            year,
            month,
            day
        ] = date
            .split("-")
            .map(Number);


        return new Date(
            year,
            month - 1,
            day,
            12,
            0,
            0
        );

    }



    /* =====================================================
       DATE PARA YYYY-MM-DD
    ====================================================== */

    function formatDate(date) {

        const year =
            date.getFullYear();


        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                date.getDate()
            ).padStart(
                2,
                "0"
            );


        return `${year}-${month}-${day}`;

    }



    /* =====================================================
       FORMATO HUMANO
    ====================================================== */

    function humanDate(date) {

        return parseDate(date)
            .toLocaleDateString(
                "pt-BR",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );

    }



    /* =====================================================
       MENSAGENS
    ====================================================== */

    function showMessage(
        message,
        type = ""
    ) {

        if (!messageElement) {
            return;
        }


        messageElement.textContent =
            message;


        messageElement.className =
            "availability-message";


        if (type) {

            messageElement.classList.add(
                type
            );

        }

    }



    function clearMessage() {

        if (!messageElement) {
            return;
        }


        messageElement.textContent =
            "";


        messageElement.className =
            "availability-message";

    }

});