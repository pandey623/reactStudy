/**
 * A checkbox field
 */

let Const = require('uxcore-const');

class CheckBox extends React.Component {

    constructor(props) {
        super(props);
    }

    handleChange(e) {
        let v = this.getValue();
        v = v ? 'checked' : '';
        this.props.onchange.apply(null,[e])
    }
    
    getValue () {
        return this.refs.checkbox.checked;
    }

    render() {

        let props = this.props;
  
        if (props.mode !== Const.MODE.VIEW) {
            let renderProps= {
                className: "kuma-checkbox",
                checked: this.props.jsxchecked,
                onChange: this.handleChange.bind(this)
            }
            if (!!props.disable) {
                renderProps.disabled = true;
            }
            return <label><input type="checkbox" ref="checkbox" {...renderProps}/><s></s></label>

        }else {

            let renderProps= {
                className: "kuma-checkbox",
                checked: this.props.jsxchecked,
                disabled:true
            }
            return <label><input type="checkbox" ref="checkbox"  {...renderProps}/><s></s></label>
        }

    }

};

CheckBox.propTypes= {
};

CheckBox.defaultProps = {

};

export default CheckBox;
