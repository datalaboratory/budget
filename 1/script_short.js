var parseDate = d3.time.format("%d/%m/%y").parse,
    parseDateAndTime = d3.time.format("%d/%m/%y %H:%M").parse,
    formatYear = d3.format("02d")
    formatHour = d3.time.format("%H")

var div = d3.select("body").append("div")
    .classed("tooltip", true)
    .style("opacity", 0);

var opac = 1;

function chOpac (opct) {
        opac = Math.abs(opct - 1.5);
        return opac;
    };

var margin = {top: 60, right: 125, bottom: 20, left: 170},
    width = 1000 - margin.left - margin.right,
    height = 650 - margin.top - margin.bottom;
var spinner = new Spinner().spin(document.getElementById('123'));


d3.dsv(';')("data/data.csv", function (error, data) {

    //Обработка данных
    var categories = [];
    var total = 0;
    var t_format = d3.format(",f"); // Правильный формат цифр

    data.forEach(function (d) {
        var dateString = d.date;
        d.date        = d3.time.format("%d/%m/%y").parse(dateString.substring(0, 8));
        d.dateandtime = d3.time.format("%d/%m/%y %H:%M").parse(dateString);
        d.hour        = parseInt(dateString.substring(9, 11));
        d.week = +d.week;
        d.weekday = parseInt(d.weekday);
        d.value = +d.value.replace(',', '.').replace(/\s/g, '');
        categories.push(d.category);
        total += d.value;
    });


    //------------Вычисление вспомогательных параметров
    var categoryNest = d3.nest()
        .key(function (d) { return d.category; });

    var weekNest = d3.nest()
        .key(function (d) { return d.week; });

    var weekdayNest = d3.nest()
        .key(function (d) { return d.weekday; });

    var hourNest = d3.nest()
        .key(function (d) { return d.hour; });

    var dayNest = d3.nest()
        .key(function (d) { return d.date; });



    categories = d3.set(categories).values();
    console.log(categories);
    console.log(categories.length);

    var dataByGroup = categoryNest.entries(data);
    var dataByWeek = weekNest.entries(data);
    var dataByWeekday = weekdayNest.entries(data);
//Данные по дням в году
    var dataByDay = dayNest.entries(data);

    // посчитаем сумму затрат в группе
    dataByGroup.forEach(function (group) {
        group.sum = d3.sum(group.values, function (value) { return value.value; });
        // считаем максимальные недельные траты в группе
        group.maxWeekSum = d3.max(weekNest.entries(group.values).map(function (weeksInGroup) {
            return d3.sum(weeksInGroup.values, function (value) { return value.value; });
        }));
    });

    // отсортируем по возрастанию суммы затрат в группе
    dataByGroup.sort(function (a, b) {
        return d3.ascending(a.sum, b.sum);
    });

    // запомним, на каком расстоянии от другой группы находится данная,
    // нужно когда будем делать из них multiples
    // Данная константа выстраивает группы в столбик по вертикали
    var offsetSum = 0;
    dataByGroup.forEach(function (group) {
        // магическая константа (6000) - минимальные недельные траты, которые соотв. по размеру строке текста. Должна зависеть от высоты и общих трат
        offsetSum += Math.max(group.maxWeekSum, 12000) + 2000;
        group.offsetSum = offsetSum;
    });

    //Вычисляем длину дня в пикселях. Должно быть динамическим с зафиксированным минимальным значением.
    var day = width/(data[data.length-1].week);

    var weekMax = 0;
    dataByWeek.forEach(function (group) {
        var offset = 0,
            offset2 = 0;
        var offsetByCategory = [];

        // Параметр для масштабирования вертикальных столбцов
        var t = d3.max(weekNest.entries(group.values).map(function (weeksInGroup) {
            return d3.sum(weeksInGroup.values, function (value) { return value.value; });
        }));
        if (t>weekMax) { weekMax = Math.round(t); console.log(group.key); };

        group.values.forEach(function (value) {
            if (offsetByCategory[value.category] > 0) {
                value.categoryOffset = offsetByCategory[value.category];
                offsetByCategory[value.category] += value.value + 100;
            } else {
                value.categoryOffset = 0;
                offsetByCategory[value.category] = value.value;
            };
            value.nocashOffset = offset2;
            value.valueOffset = offset;
            if (value.category !== "Прочие расходы") {offset2 += value.value + 20;};
            offset += value.value + 20;
        })
    });

    console.log(weekMax);
//------------/Вычисление вспомогательных параметров

    console.log(data[0].date);
    console.log(data[data.length-1].date)
    console.log(dataByDay)

    //Уточняем total в заголовке

    d3.select(".total")
    .text(t_format(total).replace(/,/g," "));
    // ...и тайтле
    d3.select("title")
    .text(t_format(total).replace(/,/g," ") + " руб., потраченных в 2013…2014 годах")


    // Устанавливаем scale для осей
    // Для оси времнеи на графике stacked (по неделям). СТАРАЯ, исп. только для флагов стран.
    var x = d3.time.scale().domain([data[0].date, data[data.length-1].date])
        .range([0, width]),
        // Для оси времнеи на графике stacked (по неделям)
        x0 = d3.time.scale().domain([data[0].week, data[data.length-1].week])
        .range([0, width]),
        // Для оси времени на графике weekdays (по дням недели и часам)
        x2 = d3.scale.linear().domain([1, 7])
        .range([5, 6*126]);

    // Для высоты элементов на графике stacked (по неделям)
    var y0 = d3.scale.linear().domain([0, weekMax*1.1])
        .range([0, height]),
        // Для вертикальных осей затрат и вертикального позиционирования на графике stacked (по неделям)
        y1 = d3.scale.linear().domain([0, weekMax*1.1])
        .range([height, 0]),
        // Для вертикальной оси времени на графике weekdays (по дням недели и часам)
        y3 = d3.scale.linear().domain([23, 0]).range([23*23, 0]);

    var r = d3.scale.sqrt();

    //ось времнеи на графике stacked (по неделям)
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .tickFormat(d3.time.format('%b')),
        // Ось дней недели на графике weekdays (по дням недели и часам)
        xAxis2 = d3.svg.axis()
        .scale(x2)
        .orient("bottom")
        .ticks(7)
        // .tickValues(["Mon","Tue","Thur"])
        // .tickValues(["Пн","Вт","Ср"])
        ,

        yAxis3 = d3.svg.axis()
        .scale(y3)
        .orient("left")
        .tickValues([00, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);


    var color = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5', '#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39', '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b', '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6'];

    // var floor =  [-0.5, -1, 11, 15, 19, 24, 5, 13, 4.5, 8, 6, 9, 3.5, 2, 12, 7, 0.5, 10, 3, 1, 0];

    var svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Показываем с наличными?
    var nocash = document.settings.nocash;

//------------old_border

// //-----------TEMP
// d3.select('svg').append("rect")
//     .attr("width",width + margin.left +margin.right)
//     .attr("height",height + margin.top + margin.bottom)
//     .style("fill","none")
//     .style("stroke","red"); // Красный - граница svg
// svg.append("rect")
//     .attr("width",width)
//     .attr("height",height)
//     .style("fill","none")
//     .style("stroke","steelblue"); // Синий - граница рабочей группы в svg
// //-----------/TEMP


    // var date = new Date()

    //Создаём оси
    svg.append("g")
      .attr("class", "xAxis")
      .call(xAxis);

    var month=["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];

    svg.select(".xAxis").selectAll("text")
    .style("text-anchor","start")
    .text(function(d,i){
        // console.log(this.__data__.getFullYear() + " " + month[this.__data__.getMonth()]);
        if (this.__data__.getMonth() === 0 || i === 0) {
            return month[this.__data__.getMonth()] + " " + this.__data__.getFullYear();
        } else {
            return month[this.__data__.getMonth()];
        };

    });

    svg.append("g")
      .attr("class", "xAxis2")
      .call(xAxis2);

    svg.append("g")
      .attr("class", "xAxis22")
      .call(xAxis2);

    svg.select(".xAxis2").selectAll("text")
    .data(["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"])
    .text(function(d){return d;});
    svg.select(".xAxis22").selectAll("text")
    .data(["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"])
    .text(function(d){return d;});



    svg.append("g")
      .attr("class", "yAxis31")
      .call(yAxis3);

    svg.append("g")
      .attr("class", "yAxis32")
      .call(yAxis3);
    //Закончили рисовать оси

    var group = svg.selectAll(".group")
        .data(dataByGroup)
        .enter().append("g")
        .attr("class", "group")
        .attr("id",function (d) {return d.key; })
        .attr("transform", function (d) { return "translate(0,0)"; });

    group.append("text")
        .attr("class", "group-label")
        .attr("x", -10)
        .attr("y", height+100)
        .attr("dy", ".35em")
        .style("fill", function (d) { return color[categories.indexOf(d.key)]; })
        .text(function (d) { return d.key });

    group.append("text")
        .attr("class", "group-sum")
        .attr("x", width + day*3)
        .attr("y", height + 100)
        .attr("dy", ".35em")
        .style("fill", function (d) { return color[categories.indexOf(d.key)]; })
        .text(function (d) { return t_format(Math.floor(d.sum)).replace(/,/g," "); });

    group.selectAll("rect")
        .data(function (d) { return d.values; })
        .enter().append("rect")
        .style("fill", function (d) { return color[categories.indexOf(d.category)]; })
        .on('mouseover', function (d, i){
            d3.selectAll("rect").transition ().delay(100)
                .attr('opacity', function (d, j){
                    return i==j && 1 || 1
                });

            div.transition ()
                .duration (100)
                .style("opacity", 0.9);

            div.html(function() {
            	if (d.target==="") { return d.category + ": " + d.value }
            		else {
            			return d.category + " (" + d.target + "): " + d.value};
            	})
                .style("left", (d3.event.pageX-155) + "px")
                .style("top", (d3.event.pageY+20) + "px");
        })
        .on("mouseout", function (d) {
            div.transition ()
                .duration (100)
                .style("opacity", 0);
        });

    d3.dsv(';')("data/geo.csv", function (error, data) {
        data.forEach(function (d) {
          d.date = parseDate(d.date);
          d.path = d.path;
        });

        var div = d3.select("body").append("div")
          .classed("tooltip", true)
          .style("opacity", 0);

        d3.select(".countries").selectAll("img")
	      .data(data)
	      .enter().append("img")
	      .attr("class", "geo")
	      .attr("src", function (d) { return "../geo-img/" + d.path; })
	      .attr("title", function (d) { return d.country; })
	      .attr("style", function (d) {
            console.log(d.path);
	          var xFlag = x(d.date) + margin.left;
	          return "left:" + xFlag + "px; top:648px";
	      });
    });

    spinner.stop();
    //Запускаем дефолтный вариант - stacked по неделям;
    transitionStacked();


    //При смене значения радиокнопки запускаем соответствующую функцию;
    d3.selectAll("input").on("change", change);
    function change() {
        console.log("changed to " + this.value)
        if (this.value == "stacked") {transitionStacked()}
            else if (this.value == "multiples") {transitionMultiples()}
                else if (this.value == "days") {transitionDays()}
                    else if (this.value == "nocash") {update()};
    };

    //Добавляем копирайт
    d3.select("body")
        .append("div")
        .attr("class","copyright")
        .html('Визуализация <a href="http://datalaboratory.ru">Лаборатории данных</a>, данные анонимного хабра-пользователя');

    // d3.select("body")
    //     .append("div")
    //     .attr("class","anons")
    //     .html('12, 13 и 15 апреля <a href="http://brainwashing.pro/dataviz">курс по визуализации данных')
    //     .style("left","652px");

// Далее пошли описания функций для радио-кнопок
    function transitionStacked() {
        if (nocash.checked) {
            y0 = d3.scale.linear().domain([0, 65000*1.1])
            .range([0, height]),
            // Для вертикальных осей затрат и вертикального позиционирования на графике stacked (по неделям)
            y1 = d3.scale.linear().domain([0, 65000*1.1])
            .range([height, 0]);
        } else {
            y0 = d3.scale.linear().domain([0, weekMax*1.1])
            .range([0, height]),
            // Для вертикальных осей затрат и вертикального позиционирования на графике stacked (по неделям)
            y1 = d3.scale.linear().domain([0, weekMax*1.1])
            .range([height, 0]);
        };

    var yAxis1 = d3.svg.axis()
        .scale(y1)
        .orient("left")
        .tickFormat(d3.format("d")),

        yAxis2 = d3.svg.axis()
        .scale(y1)
        .orient("right")
        .tickValues(function(){if (nocash.checked) {return [62348]} else {return [weekMax]};})
        .tickFormat(d3.format("d"));

        var t = svg.transition().duration (500);

        svg.selectAll(".yAxis1").remove();
        svg.selectAll(".yAxis2").remove();


        svg.append("g")
          .attr("class", "yAxis1")
          .transition().duration (1000)
          .call(yAxis1);

        svg.append("g")
          .attr("class", "yAxis2")
          .attr("transform", "translate(" + (width + day) + ",0)")
          .transition().duration (1000)
          .call(yAxis2);


        t.select(".xAxis")
            .attr("transform", "translate(0,"+ (height - 3) +")");

        t.select(".xAxis2")
            .attr("transform", "translate(0,"+ (0 - margin.top - 500) +")");

        t.select(".xAxis22")
            .attr("transform", "translate(0," + (height + margin.bottom + 500) + ")");

        // t.select(".yAxis1")
        //     .attr("transform", "translate(0,0)");

        // t.select(".yAxis2")
        //     .attr("transform", "translate(" + (width + day) + ",0)");

        t.select(".yAxis31")
            .attr("transform", "translate(" + (0 - margin.left - 500) + ",33)");

        t.select(".yAxis32")
            .attr("transform", "translate(" + (width + margin.right + 500) + ",33)");

        d3.selectAll(".geo").transition ().duration (500).
            style("opacity", 1);

        g = t.selectAll(".group")
            .attr("transform", "translate(0,0)");

        g.selectAll("rect")
            .transition ().duration (500)
            .attr("x", function (d) { return x0(d.week); })
            // .attr("y", function (d) { return y1(d.value+d.valueOffset);  })
            .attr("y", function (d) {
                if (nocash.checked) { return y1(d.value+d.nocashOffset);}
                    else { return y1(d.value+d.valueOffset);};
            })
            .attr("height", function (d) {
                if (nocash.checked && d.category === "Прочие расходы") { return 0;}
                    else { return y0(d.value);};
            })
            .attr("width", day-1);

        g.select(".group-label").attr("y", height + 100)
        g.select(".group-sum").attr("y", height + 100)
    };

    function transitionMultiples() {
        var t = svg.transition().duration (500);

        t.select(".xAxis")
            .attr("transform", "translate(0,"+ (height - 3) +")");

        t.select(".xAxis2")
            .attr("transform", "translate(0,"+ (0 - margin.top - 500) +")");

        t.select(".xAxis22")
            .attr("transform", "translate(0," + (height + margin.bottom + 500) + ")");

        t.select(".yAxis1")
            .attr("transform", "translate(" + (0 - margin.left - 500) + ",0)");

        t.select(".yAxis2")
            .attr("transform", "translate(" + (width + margin.right + 500) + ",0)");

        t.select(".yAxis31")
            .attr("transform", "translate(" + (0 - margin.left - 500) + ",33)");

        t.select(".yAxis32")
            .attr("transform", "translate(" + (width + margin.right + 500) + ",33)");

        d3.selectAll(".geo").transition ().duration (500).
        	style("opacity", 1);



        if (nocash.checked) {
            var offsetConstant = height / 21.8,
                _y1 = d3.scale.linear().domain([0, 25000]).range([0, 29]), //domain
                _y2 = d3.scale.linear().domain([0, 25000]).range([29, 0]);
            } else {
            var offsetConstant = height / 36.5,
                _y1 = d3.scale.linear().domain([0, 42000]).range([0, 29]), //domain
                _y2 = d3.scale.linear().domain([0, 42000]).range([29, 0]);
            };

        // if (nocash.checked) {
        //     var offsetConstant = height / 12.1,
        //         _y1 = d3.scale.linear().domain([0, 10000]).range([0, 21]),
        //         _y2 = d3.scale.linear().domain([0, 10000]).range([21, 0]);
        //     } else {
        //     var offsetConstant = height / 29.3,
        //         _y1 = d3.scale.linear().domain([0, 10000]).range([0, 10]),
        //         _y2 = d3.scale.linear().domain([0, 10000]).range([10, 0]);
        //     };


        g = t.selectAll(".group")
            .attr("transform", function (d,i) {
                if (nocash.checked && d.key === "Прочие расходы") {
                    return "translate(0,"+ 3000 +")";
                }
                else {return "translate(0,"+ (d.offsetSum/22000) * offsetConstant +")";};

            });


        g.selectAll("rect")
            .attr("height", function (d) { return _y1(d.value); })
            .attr("width", day-1)
            .attr("x", function (d) { return x0(d.week); })
            .attr("y", function (d) { return _y2(d.value + d.categoryOffset); })
            .style("opacity", 1);

        g.select(".group-label").attr("y", 24);
        g.select(".group-sum").attr("y", 24);

    };

    function transitionDays() {

    	// Добавление параметра shift:
        // 		shift = все предыдущие значения этой категории + значения всех предыдущих категорий этого дня и часа
        // - для каждого значения:
    	data.forEach(function (d,i) {
    		d.shift = 0;
    		// 	Смотрим категорию.
    		// Создаём массив "предыдущих" категорий
    		var cut_categories = categories.slice(0,categories.indexOf(d.category));
    		// Смотрим все значения data.
    		for (var n = 0; n < data.length; n++) {
                //Если "Без наличных" и значение с наличными, то их в shift не учитываем
                if (nocash.checked && data[n].category === "Прочие расходы") {
                    // console.log("пропускаем наличку! " + data[n].weekday + " " + data[n].hour);
                    continue;
                };

    			// console.log(data[n]);
			    // 	Если значение в этот день и час
				if (data[n].hour === d.hour && data[n].weekday === d.weekday) {
			        // 		Если значение из предыдущих категорий  Или если значение из этой категории и Если индекс значения меньше i
			        if ((cut_categories.indexOf(data[n].category) != -1) || (data[n].category === d.category && n<i)) {
			        	// 			Прибавляем к shift
			        	// if (d.hour===12 && d.weekday === 1) {console.log("К " + d.shift + " (" + d.target + ") " + " прибавляем " + data[n].value*0.03/20 + " от " + data[n].target + " (" + n + data[n].category + ") ");};
			        	if (nocash.checked) {d.shift+=data[n].value*0.045/20;} else {d.shift+=data[n].value*0.03/20;};

			        //
			        };
				};

    		};
    		// if (d.hour===12 && d.weekday === 1) { console.log("||" + i +". " + d.target + ", (" + d.category + ") не входит в [" + cut_categories  + "], сдвиг " + d.shift + ", ширина -  " + d.value*0.03/20)};
    	});

        var t = svg.transition ().duration (500);

        t.select(".xAxis")
            .attr("transform", "translate(0,"+ (height + margin.bottom + 500) +")");

        t.select(".xAxis2")
            .attr("transform", "translate(0,"+ (0 - margin.top - 500) +")");

        t.select(".xAxis22") //
            .attr("transform", "translate(0," + (height - 3) +")");

        t.select(".yAxis1")
            .attr("transform", "translate(" + (0 - margin.left - 500) + ",0)");

        t.select(".yAxis2")
            .attr("transform", "translate(" + (width + 100) + ",0)");

        t.select(".yAxis31") //
            .attr("transform", "translate(0,33)");

        t.select(".yAxis32") //
            .attr("transform", "translate(850,33)");



        d3.selectAll(".geo").transition ().duration (500).
        	style("opacity", 0);

        g = t.selectAll(".group")
            .attr("transform", "translate(0,0)");

        g.selectAll("rect")
            .transition().duration (500)
            .attr("x", function (d) { return (d.weekday-1)*125 + d.shift; })
            //.attr("x", function (d) { return (d.weekday-1)*125+d.z*0.03/20; })
            .attr("y", function (d) { return d.hour*23+23; })
            .attr("height", 20 )
            .attr("width", function (d) {
                if (nocash.checked) {
                    if (d.category === "Прочие расходы") {
                        return 0;
                    } else {
                        return d.value*0.045/20;
                    };
                } else {
                    return d.value*0.03/20;
                };

            })
            // .attr("stroke","black")
            .style("opacity", 1);

        g.select(".group-label").attr("y", height + 100);
        g.select(".group-sum").attr("y", height + 100);
    };

    function update() {
        console.log("run update")
        for (var i = document.settings.mode.length - 1; i >= 0; i--) {
            if (document.settings.mode[i].checked) {document.settings.mode[i].__onchange()};
        };
    };

});
