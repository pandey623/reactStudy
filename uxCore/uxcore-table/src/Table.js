/**
 * Table Component for uxcore
 * @author zhouquan.yezq
 *
 * Copyright 2014-2015, UXCore Team, Alinw.
 * All rights reserved.
 */

let Header = require("./Header");
let Tbody  = require("./Tbody");
let ActionBar = require("./ActionBar");
let CellField = require('./Cell/CellField');
let Pagination  = require("uxcore-pagination");
let Const = require('uxcore-const');
let assign = require('object-assign');
let deepcopy = require('deepcopy');
let deepEqual = require('deep-equal');
let classnames = require("classnames");

class Table extends React.Component {

    constructor(props) {
        super(props);
        this.uid = 0;
        this.fields = {};
        this.state = {
            data: this.addValuesInData(deepcopy(this.props.jsxdata)), // checkbox 内部交互
            columns: this.processColumn(), // column 内部交互
            showMask: this.props.showMask, // fetchData 时的内部状态改变
            pageSize: props.pageSize, // pagination 相关
            currentPage: props.currentPage, // pagination 相关
            activeColumn: null,
            searchTxt: "",
            passedData: null,
            params: null,
            selected: [],
            expanded: false
        };
    }

    componentWillMount() {
        this.fetchData();
    }

    componentDidMount() {
        let me = this;
        me.el = ReactDOM.findDOMNode(me);
        if (!!me.state.data && !!me.state.data.datas) {
            console.warn("Table: 'content.data' rather than 'content.datas' is recommended, the support for 'content.datas' will be end from ver. 1.3.0")
        }
    }

    componentWillReceiveProps(nextProps) {
        let me = this;
        let newData = {};
        if (!!nextProps.jsxdata && !!me.props.jsxdata && !me._isEqual(nextProps.jsxdata, me.props.jsxdata)) {
            // Data has changed, so uid which is used to mark the data should be reset.
            me.uid = 0;
            newData['data'] = me.addValuesInData(deepcopy(nextProps.jsxdata));
            me.data = deepcopy(newData['data']);
        }
        if (nextProps.pageSize != me.props.pageSize) {
            newData['pageSize'] = nextProps.pageSize;
        }
        if (nextProps.currentPage != me.props.currentPage) {
            newData['currentPage'] =  nextProps.currentPage;
        }
        if (!!nextProps.jsxcolumns && !!me.props.jsxcolumns && !me._isEqual(nextProps.jsxcolumns, me.props.jsxcolumns)) {
            newData['columns'] = me.processColumn(nextProps)
        }
        me.setState(newData);

    }

    componentWillUnmount() {
        let me = this;
    }

    /**
     * For inline edit
     * receive changes from cell field and change state.data
     * inform users of the change with dataKey & pass
     */

    handleDataChange(obj) {
        let me = this;
        let {jsxid, column, value, text, pass} = obj;
        let dataKey = column.dataKey;
        let editKey = column.editKey || dataKey;
        let data = deepcopy(me.state.data);
        let changedData = {};
        for (let i = 0; i < data.data.length; i++) {
            if (data.data[i].jsxid == jsxid) {
                data.data[i][dataKey] = text;
                data.data[i][editKey] = value;
                changedData = data.data[i];
            }
        }

        me.setState({
            data: data
        }, () => {
            me.props.onChange({
                data: me.state.data,
                editKey: editKey,
                dataKey: dataKey,
                changedData: changedData,
                pass: pass
            });
        })


    }

    /**
     * register CellField to Table for the global validation
     * @param field {element} the cell field to be registered
     */

     attachCellField(validate, name) {
        let me = this;
        if (!name) {
            console.error("Table: name can not be empty, check the dataKey of the column config");
        }
        else {
            me.fields[name] = validate;
        }
     }

    /**
     * cancel the CellField when it is unmounted.
     * @param field {element} the cell field to be canceled.
     */

     detachCellField(name) {
        delete this.fields[name];
     }


    /**
     * simple method to compare two datas, 
     * only support the data which JSON can parse.
     */

    _isEqual(a, b) {
        return deepEqual(a, b);
    }


    /**
     * get Query Object by combining data from searchBar, column order, pagination
     * and fetchParams.
     * @param from {string} used in props.beforeFetch
     */

    getQueryObj(from) {

        let me = this, queryObj = {};
        if (me.props.passedData) {
            let queryKeys = me.props.queryKeys;
            if (!queryKeys) {
                queryObj = me.props.passedData;
            }
            else {
                queryKeys.forEach(function(key) {
                    if(me.props.passedData[key] !== undefined) {
                        queryObj[key]= me.props.passedData[key];
                    }
                })
            }
        }

        // pagination
        queryObj = assign({}, queryObj, {
            pageSize: me.state.pageSize,
            currentPage: me.state.currentPage
        });

        // column order
        let activeColumn = this.state.activeColumn;
        if(!!activeColumn) {
            queryObj = assign({}, queryObj, {
                orderColumn: activeColumn.dataKey,
                orderType: activeColumn.orderType
            })
        }

        // search query
        let searchTxt = me.state.searchTxt
        if (!!searchTxt) {
            queryObj = assign({}, queryObj, {
               searchTxt: searchTxt
            })
        }

        // fetchParams has the top priority 
        if(!!me.props.fetchParams) {
            queryObj = assign({}, queryObj, me.props.fetchParams);
        }

        return me.props.beforeFetch(queryObj, from);
    }
    
    /**
     * fetch Data via Ajax
     * @param from {string} tell fetchData where it is invoked, the param will be 
     * passed to props.beforeFetch in order to help the user.
     */

    fetchData(from) {

        let me = this;
        // reset uid cause table data has changed
        me.uid = 0; 
        
        // fetchUrl has the top priority.
        if (!!me.props.fetchUrl) {
            if (!me.state.showMask) {
                me.setState({
                    showMask: true
                });
            }
            let ajaxOptions = {
                url: me.props.fetchUrl,
                data: me.getQueryObj(from),
                dataType: "json",
                success: function(result) {
                    if (result.success === true || result.hasError === false) {
                        let _data = result.content;
                        let processedData = me.addValuesInData(me.props.processData(deepcopy(_data)));
                        let updateObj= {
                          data: processedData,
                          showMask: false
                        };
                        if (processedData.currentPage !== undefined) {
                            updateObj.currentPage = processedData.currentPage;
                        }
                        me.data = deepcopy(processedData);
                        me.setState(updateObj)
                    }
                    else {
                        me.props.onFetchError(result);
                    }
                }
            };

            if (/\.jsonp/.test(me.props.fetchUrl)) {
                ajaxOptions.dataType = "jsonp"
            }
            
            $.ajax(ajaxOptions);
        }

        else if (!!me.props.passedData) {

            if (!me.props.queryKeys) {
                let data = me.addValuesInData(me.props.processData(deepcopy(me.props.passedData)));
                me.setState({
                    data: data
                });
                me.data = deepcopy(data);
            }
            else {
                let data = {};
                me.props.queryKeys.forEach((key, index) => {
                    if (me.props.passedData[key] !== undefined) {
                        data[key] = me.props.passedData[key];
                    }
                });
                let processedData = me.addValuesInData(me.props.processData(deepcopy(data)));
                me.setState({
                    data: processedData
                });
                me.data = deepcopy(processedData);
            }
        }
        else if (!!this.props.jsxdata) {
            let data = this.addValuesInData(deepcopy(this.props.jsxdata));
            me.setState({
                data: data
            });
            me.data = deepcopy(data);
        }
        else {
            //default will create one row
            let data = {
                data: [{
                    jsxid: me.uid++,
                    __mode__: Const.MODE.EDIT
                }],
                "currentPage": 1,
                "totalCount": 0
            };
            me.data = deepcopy(data);
            me.setState({
                "data": deepcopy(data)
            })
        }

    }
    

    processColumn(props) {

        props = props || this.props;

        let me = this,
            columns = deepcopy(props.jsxcolumns),
            hasCheckboxColumn = false;

        columns.forEach((item) => {
            if (item.type == 'checkbox') {
                hasCheckboxColumn = true;
                me.checkboxColumn = item;
                me.checkboxColumnKey = item.dataKey;
                item.width = item.width || 46;
                item.align = item.align || 'right';
            }
        });

        // filter the column which has a dataKey 'jsxchecked' & 'jsxtreeIcon'

        columns = columns.filter((item) => {
            return item.dataKey !== 'jsxchecked' && item.dataKey !== 'jsxtreeIcon';
        });
        // if hidden is not set, then it's false


        columns = columns.map((item,index) => {
            item.hidden = !!item.hidden;
            return item;
        });

        if (!!props.rowSelection & !hasCheckboxColumn) {
            me.checkboxColumn = { dataKey: 'jsxchecked', width: 46, type:'checkbox', align:'right'};
            me.checkboxColumnKey = 'jsxchecked';

            columns = [me.checkboxColumn].concat(columns)
        }

        // no rowSelection but has parentHasCheckbox, render placeholder
        else if (!!props.parentHasCheckbox) {
            columns = [{dataKey: 'jsxwhite', width: 46, type: 'empty'}].concat(columns);
        }


        if (!!props.subComp && props.renderModel !== 'tree') {
            columns = [{dataKey: 'jsxtreeIcon', width: 34, type: 'treeIcon'}].concat(columns);
        }
        // no subComp but has passedData, means sub mode, parent should has tree icon,
        // render tree icon placeholder
        else if (!!props.passedData) {
            columns = [{dataKey: 'jsxwhite', width: 34,type: 'empty'}].concat(columns);
        }

        return columns;
    }

    handleColumnPickerChange(checkedKeys) {
        let _columns = deepcopy(this.state.columns);
        _columns.forEach((item, index) => {
            if ('group' in item) {
                item.columns.forEach((ele, idx) => {
                    if (checkedKeys.indexOf(ele.dataKey) !== -1) {
                        ele.hidden = false;
                    }
                    else {
                        ele.hidden = true;
                    }
                })
            }
            else {
                if (checkedKeys.indexOf(item.dataKey) !== -1) {
                    item.hidden = false;
                }
                else {
                    item.hidden = true;
                }
            }
        });
        this.setState({
            columns: _columns
        })
        
    }

    /**
     * change SelectedRows data via checkbox, this function will pass to the Cell
     * @param checked {boolean} the checkbox status
     * @param rowIndex {number} the row Index
     * @param fromMount {boolean} onSelect is called from cell Mount is not expected.
     */

    changeSelected(checked, rowIndex, fromMount) {

        let me = this;
        let _content = deepcopy(this.state.data);
        let _data = _content.datas || _content.data;

        _data.map((item,index) => {
            if (item.jsxid == rowIndex) {
                item[me.checkboxColumnKey] = checked;
                return item;
            }
        });

        me.setState({
            data: _content
        }, () => {
            if (!fromMount) {
                let data = me.state.data.datas || me.state.data.data;
                let selectedRows = data.filter((item, index) => {
                    return item[me.checkboxColumnKey] == true
                });
                !!me.props.rowSelection && !!me.props.rowSelection.onSelect && me.props.rowSelection.onSelect(checked, data[rowIndex], selectedRows)
            }
        })
    }

    selectAll(checked) {

        let me = this;
        let _content = deepcopy(me.state.data);
        let _data = _content.datas || _content.data;
        let rowSelection = me.props.rowSelection;

        let selectedRows = [];
        _data = _data.forEach((item,index) => {
            if (!('isDisable' in me.checkboxColumn) || !me.checkboxColumn.isDisable(item)) {
              item[me.checkboxColumnKey] = checked;
              selectedRows.push(item);
            }
        });

        if(!!rowSelection && !!rowSelection.onSelectAll) {
            rowSelection.onSelectAll.apply(null,[checked, checked ? selectedRows : []])
        }
        me.setState({
            data: _content
        })
    }

    onPageChange (current) {
        let me = this;
        me.setState({
            currentPage: current
        }, () => {
            me.fetchData("pagination")
        })
    }

    handleShowSizeChange(current, pageSize) {
        let me = this;
        me.setState({
            currentPage: current,
            pageSize: pageSize
        }, () => {
            me.fetchData("pagination");
        });
    }

    renderPager() {
        if (this.props.showPager && this.state.data && this.state.data.totalCount) {
            return (
                <div className="kuma-uxtable-page">
                    <Pagination className="mini" 
                                showSizeChanger={true}
                                total={this.state.data.totalCount} 
                                onShowSizeChange={this.handleShowSizeChange.bind(this)}
                                onChange={this.onPageChange.bind(this)} 
                                current={this.state.currentPage} 
                                pageSize={this.state.pageSize} />
                </div>
            );
        }
    }

    handleOrderColumnCB(type, column) {

       //this.props.activeColumn=column;
       this.setState({
         activeColumn: column
       })
       this.fetchData("order");

    }

    handleActionBarSearch(value) {
        let me = this;
        this.setState({
            searchTxt: value
        }, () => {
            me.fetchData("search");
        })
    }

    getData(validate) {
        let me = this;
        let pass = true;
        if (validate !== false) {
            for (name in me.fields) {
                let fieldPass = me.fields[name]();

                // if one field fails to pass, the table fails to pass
                if (pass) {
                    pass = fieldPass;
                }
            }
        }
        if (me.props.getSavedData) {
            // 滤除可能为空的元素
            let data = deepcopy(me.data);
            data.data = data.data.filter((item) => {
                return item != undefined;
            });
            return {data: data, pass: pass};
        }
        else {
            return {data: me.state.data, pass: pass}
        }
    }

    hasFixColumn() {
        let props = this.props;
        let _columns = props.jsxcolumns.filter( (item) =>{
            if (item.fixed) {
                return true
            }
        })
        if(_columns.length > 0) {
            return true;
        }
        return false
    }

    renderHeader(renderHeaderProps) {
 
      if(!this.props.showHeader) {
         return ;
      }

      if(this.hasFixColumn() ){
         return <div className="kuma-uxtable-header-wrapper">
                    <Header {...renderHeaderProps} fixedColumn='fixed' key="grid-header-fixed"/>
                    <Header {...renderHeaderProps} fixedColumn='scroll' key="grid-header-scroll"/>
                </div>
       }else {
          return <div className="kuma-uxtable-header-wrapper">
                      <Header {...renderHeaderProps} fixedColumn="no" />
                  </div>
       }
    }

    renderTbody(renderBodyProps, bodyHeight) {
      
       if (this.hasFixColumn()) {
            let {subComp, ...fixedBodyProps} = renderBodyProps;
            return (
                <div className="kuma-uxtable-body-wrapper" style={{
                    height: bodyHeight
                }}>
                    <Tbody  {...fixedBodyProps} fixedColumn='fixed' key="grid-body-fixed"/>
                    <Tbody  {...renderBodyProps} fixedColumn='scroll' key="grid-body-scroll"/>
                </div>
            )
       }
       else {
          return <div className="kuma-uxtable-body-wrapper" style={{
              height: bodyHeight
          }}>
              <Tbody  {...renderBodyProps} fixedColumn='no'/>
          </div>
       }
    }

    render() {
        let props = this.props;
        let bodyHeight;
        // if table is in sub mode, people always want to align the parent
        // and the sub table, so width should not be cared.
        let {headerHeight} = props;

        let _style = {
            width: !!props.passedData ? "auto" : props.width,
            height: props.height
        };
        let actionBarHeight = props.actionBar ? props.actionBarHeight : 0;
        let pagerHeight = (props.showPager && this.state.data && this.state.data.totalCount) ? 50 : 0;

        // decide whether the table has column groups
        let hasGroup = false;
        for (let i = 0; i < this.state.columns.length; i++) {
            if ('group' in this.state.columns[i]) {
                hasGroup = true;
                break;
            }
        }

        headerHeight = headerHeight || (hasGroup ? 80 : 40);

        if (props.height == 'auto') {
            bodyHeight = 'auto';
        } 
        else {
            bodyHeight = props.height == "100%" ? props.height : (props.height - headerHeight - actionBarHeight - pagerHeight);
        }
        let renderBodyProps = {
            columns: this.state.columns,
            data: this.state.data ? this.state.data.datas || this.state.data.data : [],
            onModifyRow: props.onModifyRow ? props.onModifyRow : function(){},
            rowSelection: props.rowSelection,
            addRowClassName: props.addRowClassName,
            subComp: props.subComp,
            mask: this.state.showMask,
            changeSelected: this.changeSelected.bind(this),
            rowHeight: this.props.rowHeight,
            height: bodyHeight,
            width: props.width,
            root: this,
            mode: props.mode,
            renderModel: props.renderModel,
            levels: props.levels,
            handleDataChange: this.handleDataChange.bind(this),
            attachCellField: this.attachCellField.bind(this),
            detachCellField: this.detachCellField.bind(this),
            key:'grid-body'
        },
        renderHeaderProps = {
            columns:  this.state.columns,
            activeColumn: this.state.activeColumn,
            checkAll: this.selectAll.bind(this),
            columnPicker: props.showColumnPicker,
            showHeaderBorder: props.showHeaderBorder,
            handleColumnPickerChange: this.handleColumnPickerChange.bind(this),
            headerHeight: props.headerHeight,
            width: props.width,
            mode: props.mode,
            orderColumnCB: this.handleOrderColumnCB.bind(this),
            key:'grid-header'

        };

        let actionBar;
        

        if(props.actionBar || props.showSearch) {
            let renderActionProps={
                onSearch: this.handleActionBarSearch.bind(this),
                actionBarConfig: this.props.actionBar,
                showSearch: this.props.showSearch,
                searchBarPlaceholder: this.props.searchBarPlaceholder,
                key:'grid-actionbar'
            };
            actionBar = <ActionBar {...renderActionProps}/>
        }

        return (
            <div className={classnames({
                [props.jsxprefixCls]: true,
                "kuma-subgrid-mode": !!props.passedData
            })} style={_style}>
                {actionBar}
                <div className="kuma-uxtable-content" style={{
                    width: !!props.passedData ? "auto" : props.width
                }}>
                   {this.renderHeader(renderHeaderProps)}
                   {this.renderTbody(renderBodyProps,bodyHeight)}
                </div>
                {this.renderPager()}
            </div>
            
        );

    }

    ///////////////////////// Util Method /////////////////////////

    /**
     * add some specific value for each row data which will be used in manipulating data & rendering.
     * used in record API.
     */

    addJSXIdsForRecord(objAux) {
        let me = this;
        if (objAux instanceof Array) {
            objAux = objAux.map((item) => { 
                if (item.jsxid == undefined || item.jsxid == null){
                    item.jsxid = me.uid++;
                }
                if (!item.__mode__) {
                    item.__mode__ = Const.MODE.EDIT
                }
                return item;
            });
        }
        else {
           objAux.jsxid = me.uid++;
        }
        return objAux;
    }

    /**
     * add some specific value for each row data which will be used in manipulating data & rendering.
     * used in method fetchData
     */

    addValuesInData(objAux) {
        if ( !objAux || (!objAux.datas && !objAux.data)) return;
        let me = this;
        let data = objAux.datas || objAux.data;
        data.forEach(function(node) {
            node.jsxid = me.uid++;
            node.__mode__ = node.__mode__ || Const.MODE.VIEW;
            me.addValuesInData(node);
        });
        return objAux;
    }

   /**
    * merge data
    */

    mergeData(data, obj) {
        let newData = deepcopy(data);

        // code compatible
        if (!!newData.datas) {
            newData.datas = newData.datas.concat(obj);
        }
        else if (!!newData.data) {
            newData.data = newData.data.concat(obj);
        }
        newData.totalCount++
        return newData;
    }

    
   /**
    * insert some data into this.state.data
    * @param objAux {Array or Object} datum or data need to be inserted
    */

    insertRecords(objAux) {
        if (typeof objAux !== "object") return;
        let me = this;
        if (!(objAux instanceof Array)) {
            objAux = [objAux];
        }

        objAux = this.addJSXIdsForRecord(objAux);

        // me.data = me.mergeData(me.data, objAux);
        this.setState({
            data: me.mergeData(me.state.data, objAux)
        });
    }

   /**
    * @param {objAux} {a:'b',c:'d',jsxid:''}
    */
    updateRecord(objAux, cb) {
        let _data = this.state.data;

        if (!_data) {
            return;
        }

        if (_data.data || _data.datas) {
            let data = _data.data || _data.datas

            data = data.map((item) => { 
                if (item.jsxid == objAux.jsxid) {
                    return objAux;
                }
                else {
                    return item;
                }
            });
            if (!!_data.data) {
                _data.data = data
            }
            else if (!!_data.datas) {
                _data.datas = data;
            }
        }
        this.setState({
          data: _data
        }, () => {
            !!cb && cb();
        })
    }

    syncRecord(objAux) {
        let me = this;
        let _data = me.data.data || me.data.datas;

        me.updateRecord(objAux, () => {
            let _stateData = me.state.data.data || me.state.data.datas;
            // _data.forEach((item, index) => {
            //     if (item.jsxid == objAux.jsxid) {
            //         _data[index] = _stateData.filter((ele) => {
            //             return ele.jsxid == objAux.jsxid
            //         })[0];
            //     }
            // });
            _stateData.forEach((item, index) => {
                if (item.jsxid == objAux.jsxid) {
                    _data[index] = item;
                }
            })
        })
    }

    removeRecords(objAux) {
      
        //at least one record
        let me = this;
        let content = this.state.data;
        let data = content.data || content.datas;

        // deepcopy protect
        let _content = deepcopy(content),
            _data = _content.data || _content.datas;

        if (Object.prototype.toString.call(objAux) !== "[object Array]") {
            objAux = [objAux];
        }

        objAux.map(function(item) {
            _data.forEach(function(element, index, array) {
                if (element.jsxid == item.jsxid) {
                    _data.splice(index, 1);
                }
            })
        });

        me.data = _content;

        this.setState({
            data: _content
        });

    }

    //////////////////////// CURD for gird ////////////////

    addEmptyRow() {
        this.insertRecords({});
    }

    addRow(rowData) {
        this.insertRecords(rowData);
    }

    resetRow(rowData) {
        let me = this;
        let updateData = {};
        let _data = me.data.datas || me.data.data;
        for (let i = 0; i < _data.length; i++) {
            if (_data[i].jsxid == rowData.jsxid) {
                updateData = deepcopy(_data[i]);
                break;
            }
        }
        updateData['__mode__'] = Const.MODE.EDIT;
        this.updateRecord(updateData);
    }

    delRow(rowData) {
        this.removeRecords(rowData);
    }

    editRow(rowData) {
        rowData.__mode__ = Const.MODE.EDIT;
        this.updateRecord(rowData);
    }

    viewRow(rowData) {
        rowData.__mode__ = Const.MODE.VIEW;
        this.updateRecord(rowData);
    }

    saveRow(rowData) {
        rowData.__mode__ = Const.MODE.VIEW;
        rowData.__edited__ = true;
        this.syncRecord(rowData);
    }

    saveAllRow() {
        let me = this;
        let data = deepcopy(me.state.data.data || me.state.data.datas);
        data.forEach((item) => {
            me.saveRow(item);
        });
    }

    editAllRow() {
        let me = this;
        let data = deepcopy(me.data.data || me.data.datas);
        data.forEach((item) => {
            me.editRow(item);
        });
    }

    toggleSubComp(rowData) {
        let _content = deepcopy(this.state.data);
        let _data = _content.data || _content.datas;

        if(_data) {
            _data = _data.map((item) => { 
                if (item.jsxid == rowData.jsxid) {
                    item.showSubComp= !item.showSubComp;
                    return item;
                }
                else {
                    return item;
                }
            });
        }
        this.setState({
            data: _content
        })
    }

};

Table.defaultProps = {
    jsxprefixCls: "kuma-uxtable",
    showHeader: true,
    width: "auto",
    height: "auto",
    mode: Const.MODE.EDIT,
    renderModel: '',
    levels: 1,
    actionBarHeight: 40,
    doubleClickToEdit: true,
    showPager: true,
    showColumnPicker: true,
    showHeaderBorder: false,
    showMask: false,
    showSearch: false,
    getSavedData: true,
    pageSize: 10,
    rowHeight: 76,
    fetchParams: {},
    currentPage:1,
    queryKeys:[],
    emptyText: "暂无数据",
    searchBarPlaceholder: "搜索表格内容",
    processData: (data) => {return data},
    beforeFetch: (obj) => {return obj},
    onFetchError: () => {},
    addRowClassName: () => {},
    onChange: () => {},
}

// http://facebook.github.io/react/docs/reusable-components.html
Table.propTypes = {
    jsxcolumns: React.PropTypes.arrayOf(React.PropTypes.object),
    width: React.PropTypes.number,
    height: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.number
    ]),
    headerHeight: React.PropTypes.number,
    pageSize: React.PropTypes.number,
    queryKeys: React.PropTypes.array,
    doubleClickToEdit: React.PropTypes.bool,
    showColumnPicker: React.PropTypes.bool,
    showPager: React.PropTypes.bool,
    showHeader: React.PropTypes.bool,
    showHeaderBorder: React.PropTypes.bool,
    showMask: React.PropTypes.bool,
    showSearch: React.PropTypes.bool,
    searchBarPlaceholder: React.PropTypes.string,
    subComp: React.PropTypes.element,
    emptyText: React.PropTypes.oneOfType([
        React.PropTypes.string,
        React.PropTypes.element
    ]),
    jsxdata: React.PropTypes.object,
    fetchUrl: React.PropTypes.string,
    fetchParams: React.PropTypes.object,
    actionBar: React.PropTypes.oneOfType([
        React.PropTypes.array,
        React.PropTypes.object
    ]),
    processData: React.PropTypes.func,
    beforeFetch: React.PropTypes.func,
    onFetchError: React.PropTypes.func,
    addRowClassName: React.PropTypes.func,
    passedData: React.PropTypes.object,
    // For inline edit
    getSavedData: React.PropTypes.bool,
    onChange: React.PropTypes.func,
    // For tree Mode
    renderModel: React.PropTypes.string,
    levels: React.PropTypes.number
}

Table.displayName = "Table";
Table.CellField = CellField;
Table.Constants = Const;

module.exports = Table;
